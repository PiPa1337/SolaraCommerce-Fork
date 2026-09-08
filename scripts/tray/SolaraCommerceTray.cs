using System;
using System.Collections.Generic;
using System.Diagnostics;
using System.Drawing;
using System.Globalization;
using System.IO;
using System.Net;
using System.Security.Cryptography;
using System.Text;
using System.Threading;
using System.Web.Script.Serialization;
using System.Windows.Forms;

internal sealed class SessionRecord
{
    public string format { get; set; }
    public int version { get; set; }
    public string sessionId { get; set; }
    public int processId { get; set; }
    public int port { get; set; }
    public string projectRoot { get; set; }
    public string startedAt { get; set; }
    public bool managed { get; set; }
    public string shutdownToken { get; set; }

    public string Url
    {
        get { return "http://127.0.0.1:" + port.ToString(CultureInfo.InvariantCulture); }
    }
}

internal sealed class SessionProbe
{
    public bool managed { get; set; }
    public string sessionId { get; set; }
}

internal sealed class LauncherResult
{
    public string sessionId { get; set; }
    public int port { get; set; }
    public string url { get; set; }
}

internal sealed class DiagnosticResult
{
    public int count { get; set; }
    public int failures { get; set; }
    public List<SessionRecord> sessions { get; set; }
}

internal sealed class TrayServices
{
    private readonly string applicationRoot;
    private readonly string instancesRoot;
    private readonly JavaScriptSerializer json = new JavaScriptSerializer();

    public TrayServices(string root)
    {
        applicationRoot = Path.GetFullPath(root).TrimEnd(Path.DirectorySeparatorChar, Path.AltDirectorySeparatorChar);
        instancesRoot = Path.Combine(applicationRoot, ".solara-runtime", "instances");
    }

    public string ApplicationRoot
    {
        get { return applicationRoot; }
    }

    public List<SessionRecord> DiscoverSessions()
    {
        List<SessionRecord> sessions = new List<SessionRecord>();
        if (!Directory.Exists(instancesRoot)) return sessions;

        string[] files;
        try
        {
            files = Directory.GetFiles(instancesRoot, "*.json", SearchOption.TopDirectoryOnly);
        }
        catch
        {
            return sessions;
        }

        foreach (string file in files)
        {
            SessionRecord session = null;
            try
            {
                session = json.Deserialize<SessionRecord>(File.ReadAllText(file, Encoding.UTF8));
            }
            catch
            {
                DeleteRecord(file);
                continue;
            }

            if (!IsValidRecord(session) || !IsLiveSession(session))
            {
                DeleteRecord(file);
                continue;
            }
            sessions.Add(session);
        }

        sessions.Sort(delegate(SessionRecord left, SessionRecord right)
        {
            int portOrder = left.port.CompareTo(right.port);
            if (portOrder != 0) return portOrder;
            return string.CompareOrdinal(left.startedAt ?? "", right.startedAt ?? "");
        });
        return sessions;
    }

    public bool CloseSession(SessionRecord session)
    {
        if (!IsValidRecord(session) || !IsLiveSession(session))
        {
            DeleteRecord(SessionPath(session == null ? "" : session.sessionId));
            return true;
        }

        try
        {
            HttpWebRequest request = (HttpWebRequest)WebRequest.Create(session.Url + "/__solara/shutdown");
            request.Method = "POST";
            request.Timeout = 1000;
            request.ReadWriteTimeout = 1000;
            request.ContentType = "application/json";
            request.Accept = "application/json";
            request.ContentLength = 0;
            request.Referer = session.Url + "/";
            request.Headers["Origin"] = session.Url;
            request.CookieContainer = new CookieContainer();
            request.CookieContainer.Add(new Uri(session.Url), new Cookie("solara_shutdown", session.shutdownToken));
            using (HttpWebResponse response = (HttpWebResponse)request.GetResponse())
            {
                if ((int)response.StatusCode != 202) return false;
            }
        }
        catch
        {
            return false;
        }

        // El shutdown HTTP es asíncrono: el proceso primero cierra almacenamiento
        // y conexiones antes de borrar el registro. Esperar sólo 3 segundos deja
        // al reinicio en una carrera cuando hubo una exportación o cambio grande.
        for (int attempt = 0; attempt < 100; attempt++)
        {
            Thread.Sleep(100);
            if (!IsLiveSession(session))
            {
                DeleteRecord(SessionPath(session.sessionId));
                return true;
            }
        }
        return false;
    }

    public int CloseAll()
    {
        int failures = 0;
        foreach (SessionRecord session in DiscoverSessions())
        {
            if (!CloseSession(session)) failures++;
        }
        return failures;
    }

    public bool RestartSessions(int sessionCount, out List<LauncherResult> launched, out string error)
    {
        launched = new List<LauncherResult>();
        error = "";
        if (sessionCount < 1) sessionCount = 1;

        int closeFailures = CloseAll();
        if (closeFailures > 0 || DiscoverSessions().Count > 0)
        {
            error = "No se pudieron cerrar todas las sesiones activas de forma segura.";
            return false;
        }

        for (int index = 0; index < sessionCount; index++)
        {
            string launchError;
            LauncherResult result = StartNewSession(out launchError);
            if (result == null)
            {
                error = string.IsNullOrWhiteSpace(launchError)
                    ? "No se pudo volver a abrir una sesión."
                    : launchError;
                CloseAll();
                return false;
            }

            bool live = DiscoverSessions().Exists(delegate(SessionRecord session)
            {
                return string.Equals(session.sessionId, result.sessionId, StringComparison.Ordinal);
            });
            if (!live)
            {
                error = "El lanzador informó una sesión, pero no quedó registrada como activa.";
                CloseAll();
                return false;
            }
            launched.Add(result);
        }
        return true;
    }

    public LauncherResult StartNewSession(out string error)
    {
        error = "";
        string script = Path.Combine(applicationRoot, "scripts", "open-solara.ps1");
        if (!File.Exists(script))
        {
            error = "No se encontró scripts\\open-solara.ps1.";
            return null;
        }

        ProcessStartInfo start = new ProcessStartInfo();
        start.FileName = "powershell.exe";
        start.Arguments = "-NoLogo -NoProfile -ExecutionPolicy Bypass -File " + Quote(script) + " -NewSession -NoBrowser -Json";
        start.WorkingDirectory = applicationRoot;
        start.UseShellExecute = false;
        start.CreateNoWindow = true;
        start.RedirectStandardOutput = true;
        start.RedirectStandardError = true;

        try
        {
            using (Process process = Process.Start(start))
            {
                string output = process.StandardOutput.ReadToEnd();
                string stderr = process.StandardError.ReadToEnd();
                process.WaitForExit();
                if (process.ExitCode != 0)
                {
                    error = string.IsNullOrWhiteSpace(stderr) ? "No se pudo abrir una nueva sesión." : StripAnsi(stderr.Trim());
                    return null;
                }

                string[] lines = output.Split(new[] { '\r', '\n' }, StringSplitOptions.RemoveEmptyEntries);
                if (lines.Length == 0)
                {
                    error = "El lanzador no devolvió la sesión creada.";
                    return null;
                }
                return json.Deserialize<LauncherResult>(lines[lines.Length - 1]);
            }
        }
        catch (Exception exception)
        {
            error = StripAnsi(exception.Message);
            return null;
        }
    }

    private static string StripAnsi(string value)
    {
        if (string.IsNullOrEmpty(value)) return value;

        StringBuilder clean = new StringBuilder(value.Length);
        bool escape = false;
        bool controlSequence = false;
        foreach (char character in value)
        {
            if (escape)
            {
                if (controlSequence)
                {
                    if (character >= '@' && character <= '~')
                    {
                        escape = false;
                        controlSequence = false;
                    }
                    continue;
                }

                if (character == '[')
                {
                    controlSequence = true;
                    continue;
                }

                escape = false;
                continue;
            }

            if (character == '\u001b')
            {
                escape = true;
                continue;
            }

            clean.Append(character);
        }

        return clean.ToString().Trim();
    }

    public static void OpenUrl(string url)
    {
        ProcessStartInfo start = new ProcessStartInfo(url);
        start.UseShellExecute = true;
        Process.Start(start);
    }

    private bool IsValidRecord(SessionRecord session)
    {
        if (session == null) return false;
        if (session.format != "solara-local-session" || session.version != 1 || !session.managed) return false;
        if (session.port < 4173 || session.port > 4180) return false;
        if (string.IsNullOrWhiteSpace(session.sessionId) || session.sessionId.Length < 8 || session.sessionId.Length > 128) return false;
        foreach (char character in session.sessionId)
        {
            if (!(char.IsLetterOrDigit(character) || character == '_' || character == '-')) return false;
        }
        if (string.IsNullOrWhiteSpace(session.shutdownToken) || session.shutdownToken.Length < 16) return false;
        try
        {
            string recordRoot = Path.GetFullPath(session.projectRoot ?? "").TrimEnd(Path.DirectorySeparatorChar, Path.AltDirectorySeparatorChar);
            if (!string.Equals(recordRoot, applicationRoot, StringComparison.OrdinalIgnoreCase)) return false;
        }
        catch
        {
            return false;
        }
        return true;
    }

    private bool IsLiveSession(SessionRecord session)
    {
        try
        {
            HttpWebRequest request = (HttpWebRequest)WebRequest.Create(session.Url + "/__solara/session");
            request.Method = "GET";
            request.Timeout = 500;
            request.ReadWriteTimeout = 500;
            request.Accept = "application/json";
            using (HttpWebResponse response = (HttpWebResponse)request.GetResponse())
            using (StreamReader reader = new StreamReader(response.GetResponseStream()))
            {
                if ((int)response.StatusCode != 200) return false;
                SessionProbe probe = json.Deserialize<SessionProbe>(reader.ReadToEnd());
                return probe != null && probe.managed && string.Equals(probe.sessionId, session.sessionId, StringComparison.Ordinal);
            }
        }
        catch
        {
            return false;
        }
    }

    private string SessionPath(string sessionId)
    {
        if (string.IsNullOrWhiteSpace(sessionId)) return "";
        return Path.Combine(instancesRoot, sessionId + ".json");
    }

    private static void DeleteRecord(string path)
    {
        if (string.IsNullOrWhiteSpace(path)) return;
        try
        {
            if (File.Exists(path)) File.Delete(path);
        }
        catch
        {
        }
    }

    private static string Quote(string value)
    {
        return "\"" + value.Replace("\"", "\\\"") + "\"";
    }
}

internal sealed class TrayApplicationContext : ApplicationContext
{
    private readonly TrayServices services;
    private readonly NotifyIcon icon;
    private readonly ContextMenuStrip menu;
    private readonly System.Windows.Forms.Timer refreshTimer;
    private readonly Mutex mutex;
    private List<SessionRecord> sessions = new List<SessionRecord>();

    public TrayApplicationContext(string applicationRoot, Mutex ownedMutex)
    {
        mutex = ownedMutex;
        services = new TrayServices(applicationRoot);
        menu = new ContextMenuStrip();
        menu.ShowImageMargin = false;
        menu.Opening += delegate { RefreshMenu(); };

        icon = new NotifyIcon();
        icon.Icon = LoadApplicationIcon(applicationRoot);
        icon.Text = "SolaraCommerce";
        icon.ContextMenuStrip = menu;
        icon.Visible = true;

        refreshTimer = new System.Windows.Forms.Timer();
        refreshTimer.Interval = 2000;
        refreshTimer.Tick += delegate { RefreshSessions(); };
        refreshTimer.Start();

        RefreshMenu();

        if (sessions.Count == 0)
        {
            OpenInitialSession();
        }
    }

    private void OpenInitialSession()
    {
        string error;
        LauncherResult result = services.StartNewSession(out error);
        if (result == null)
        {
            MessageBox.Show("No se pudo abrir SolaraCommerce: " + error, "SolaraCommerce", MessageBoxButtons.OK, MessageBoxIcon.Error);
            return;
        }

        try
        {
            TrayServices.OpenUrl(result.url);
        }
        catch (Exception exception)
        {
            MessageBox.Show("La sesión inició, pero no se pudo abrir el navegador: " + exception.Message, "SolaraCommerce", MessageBoxButtons.OK, MessageBoxIcon.Warning);
        }
        RefreshMenu();
    }

    private void RefreshSessions()
    {
        sessions = services.DiscoverSessions();
        string text = "SolaraCommerce — " + sessions.Count + (sessions.Count == 1 ? " sesión" : " sesiones");
        icon.Text = text.Length <= 63 ? text : "SolaraCommerce";
    }

    private void RefreshMenu()
    {
        RefreshSessions();
        menu.Items.Clear();

        ToolStripMenuItem title = new ToolStripMenuItem("SolaraCommerce — " + sessions.Count + (sessions.Count == 1 ? " sesión" : " sesiones"));
        title.Enabled = false;
        menu.Items.Add(title);
        menu.Items.Add(new ToolStripSeparator());

        ToolStripMenuItem newSession = new ToolStripMenuItem("Abrir nueva sesión");
        newSession.Click += delegate
        {
            string error;
            LauncherResult result = services.StartNewSession(out error);
            if (result == null)
            {
                MessageBox.Show(error, "SolaraCommerce", MessageBoxButtons.OK, MessageBoxIcon.Error);
                return;
            }
            TrayServices.OpenUrl(result.url);
            RefreshMenu();
        };
        menu.Items.Add(newSession);
        menu.Items.Add(new ToolStripSeparator());

        int index = 1;
        foreach (SessionRecord session in sessions)
        {
            SessionRecord captured = session;
            ToolStripMenuItem sessionItem = new ToolStripMenuItem("Sesión " + index + " — localhost:" + session.port);
            ToolStripMenuItem open = new ToolStripMenuItem("Abrir");
            open.Click += delegate { TrayServices.OpenUrl(captured.Url); };
            ToolStripMenuItem close = new ToolStripMenuItem("Cerrar");
            close.Click += delegate
            {
                if (!services.CloseSession(captured))
                {
                    MessageBox.Show("No se pudo cerrar esa sesión de forma segura.", "SolaraCommerce", MessageBoxButtons.OK, MessageBoxIcon.Error);
                }
                RefreshMenu();
            };
            sessionItem.DropDownItems.Add(open);
            sessionItem.DropDownItems.Add(close);
            menu.Items.Add(sessionItem);
            index++;
        }

        menu.Items.Add(new ToolStripSeparator());
        ToolStripMenuItem closeAll = new ToolStripMenuItem("Cerrar todas");
        closeAll.Enabled = sessions.Count > 0;
        closeAll.Click += delegate
        {
            int failures = services.CloseAll();
            RefreshMenu();
            if (failures > 0 || sessions.Count > 0)
            {
                MessageBox.Show("Quedaron sesiones activas que no pudieron cerrarse de forma segura.", "SolaraCommerce", MessageBoxButtons.OK, MessageBoxIcon.Error);
            }
        };
        menu.Items.Add(closeAll);

        ToolStripMenuItem restart = new ToolStripMenuItem("Reiniciar aplicación");
        restart.Click += delegate { RestartApplication(); };
        menu.Items.Add(restart);

        ToolStripMenuItem exit = new ToolStripMenuItem("Salir");
        exit.Click += delegate { ExitTray(); };
        menu.Items.Add(exit);
    }

    private void RestartApplication()
    {
        int sessionCount = services.DiscoverSessions().Count;
        if (sessionCount < 1) sessionCount = 1;

        List<LauncherResult> launched;
        string error;
        if (!services.RestartSessions(sessionCount, out launched, out error))
        {
            RefreshMenu();
            MessageBox.Show("No se pudo reiniciar la aplicación: " + error, "SolaraCommerce", MessageBoxButtons.OK, MessageBoxIcon.Error);
            return;
        }

        foreach (LauncherResult result in launched)
        {
            try
            {
                TrayServices.OpenUrl(result.url);
            }
            catch (Exception exception)
            {
                MessageBox.Show("La aplicación se reinició, pero no se pudo abrir localhost: " + exception.Message, "SolaraCommerce", MessageBoxButtons.OK, MessageBoxIcon.Warning);
            }
        }
        RefreshMenu();
    }

    private void ExitTray()
    {
        services.CloseAll();
        RefreshSessions();
        if (sessions.Count > 0)
        {
            MessageBox.Show("No se puede salir mientras queden sesiones activas.", "SolaraCommerce", MessageBoxButtons.OK, MessageBoxIcon.Error);
            return;
        }
        DisposeTray();
        ExitThread();
    }

    private void DisposeTray()
    {
        refreshTimer.Stop();
        icon.Visible = false;
        icon.Dispose();
        menu.Dispose();
        mutex.ReleaseMutex();
        mutex.Dispose();
    }

    private static Icon LoadApplicationIcon(string applicationRoot)
    {
        string path = Path.Combine(applicationRoot, "apps", "studio", "public", "branding", "solara-orbit.ico");
        if (File.Exists(path)) return new Icon(path);
        return SystemIcons.Application;
    }
}

internal static class Program
{
    [STAThread]
    private static int Main(string[] args)
    {
        string applicationRoot = AppDomain.CurrentDomain.BaseDirectory.TrimEnd(Path.DirectorySeparatorChar, Path.AltDirectorySeparatorChar);
        string diagnostic = "";
        string diagnosticSessionId = "";
        string outputPath = "";

        for (int index = 0; index < args.Length; index++)
        {
            if (args[index] == "--root" && index + 1 < args.Length)
            {
                applicationRoot = args[++index];
            }
            else if (args[index] == "--output" && index + 1 < args.Length)
            {
                outputPath = args[++index];
            }
            else if (args[index] == "--diagnostic-list" || args[index] == "--diagnostic-close-all" || args[index] == "--diagnostic-restart")
            {
                diagnostic = args[index];
            }
            else if (args[index] == "--diagnostic-close" && index + 1 < args.Length)
            {
                diagnostic = args[index];
                diagnosticSessionId = args[++index];
            }
        }

        if (!string.IsNullOrEmpty(diagnostic))
        {
            if (string.IsNullOrWhiteSpace(outputPath)) return 2;
            return RunDiagnostic(applicationRoot, diagnostic, diagnosticSessionId, outputPath);
        }

        bool createdNew;
        Mutex mutex = new Mutex(true, BuildMutexName(applicationRoot), out createdNew);
        if (!createdNew)
        {
            mutex.Dispose();
            MessageBox.Show("SolaraCommerce ya está abierto en la bandeja.", "SolaraCommerce", MessageBoxButtons.OK, MessageBoxIcon.Information);
            return 0;
        }

        Application.EnableVisualStyles();
        Application.SetCompatibleTextRenderingDefault(false);
        Application.Run(new TrayApplicationContext(applicationRoot, mutex));
        return 0;
    }

    private static int RunDiagnostic(string root, string diagnostic, string diagnosticSessionId, string outputPath)
    {
        TrayServices services = new TrayServices(root);
        int failures = 0;
        if (diagnostic == "--diagnostic-restart")
        {
            int sessionCount = services.DiscoverSessions().Count;
            if (sessionCount < 1) sessionCount = 1;
            List<LauncherResult> launched;
            string error;
            if (!services.RestartSessions(sessionCount, out launched, out error)) failures = 1;
        }
        else if (diagnostic == "--diagnostic-close-all")
        {
            failures = services.CloseAll();
        }
        else if (diagnostic == "--diagnostic-close")
        {
            SessionRecord target = services.DiscoverSessions().Find(delegate(SessionRecord session)
            {
                return string.Equals(session.sessionId, diagnosticSessionId, StringComparison.Ordinal);
            });
            if (target == null || !services.CloseSession(target)) failures = 1;
        }

        List<SessionRecord> sessions = services.DiscoverSessions();
        DiagnosticResult result = new DiagnosticResult();
        result.count = sessions.Count;
        result.failures = failures;
        result.sessions = sessions;
        Directory.CreateDirectory(Path.GetDirectoryName(Path.GetFullPath(outputPath)));
        File.WriteAllText(outputPath, new JavaScriptSerializer().Serialize(result), Encoding.UTF8);
        bool valid = failures == 0;
        if (diagnostic == "--diagnostic-close-all") valid = valid && sessions.Count == 0;
        if (diagnostic == "--diagnostic-restart") valid = valid && sessions.Count > 0;
        return valid ? 0 : 1;
    }

    private static string BuildMutexName(string applicationRoot)
    {
        byte[] bytes = Encoding.UTF8.GetBytes(Path.GetFullPath(applicationRoot).ToUpperInvariant());
        using (SHA256 hash = SHA256.Create())
        {
            byte[] digest = hash.ComputeHash(bytes);
            StringBuilder suffix = new StringBuilder();
            for (int index = 0; index < 12; index++) suffix.Append(digest[index].ToString("x2", CultureInfo.InvariantCulture));
            return "Local\\SolaraCommerceTray-" + suffix;
        }
    }
}
