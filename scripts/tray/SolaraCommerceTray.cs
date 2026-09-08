using System;
using System.Collections.Generic;
using System.Diagnostics;
using System.Drawing;
using System.Globalization;
using System.IO;
using System.Net;
using System.Net.Sockets;
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
    private readonly string trayLogPath;
    private readonly object trayLogLock = new object();
    private readonly JavaScriptSerializer json = new JavaScriptSerializer();

    public TrayServices(string root)
    {
        applicationRoot = Path.GetFullPath(root).TrimEnd(Path.DirectorySeparatorChar, Path.AltDirectorySeparatorChar);
        instancesRoot = Path.Combine(applicationRoot, ".solara-runtime", "instances");
        trayLogPath = Path.Combine(applicationRoot, ".solara-runtime", "logs", "tray.log");
    }

    public string ApplicationRoot
    {
        get { return applicationRoot; }
    }

    public void Log(string message)
    {
        try
        {
            lock (trayLogLock)
            {
                Directory.CreateDirectory(Path.GetDirectoryName(trayLogPath));
                File.AppendAllText(
                    trayLogPath,
                    DateTime.Now.ToString("s", CultureInfo.InvariantCulture) + " " + message + Environment.NewLine,
                    Encoding.UTF8
                );
            }
        }
        catch
        {
        }
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

            if (!IsValidRecord(session))
            {
                DeleteRecord(file);
                continue;
            }

            SessionProbe probe;
            bool reachable;
            bool validProbe = TryGetSessionProbe(session, out probe, out reachable);
            if (validProbe && probe.managed && string.Equals(probe.sessionId, session.sessionId, StringComparison.Ordinal))
            {
                sessions.Add(session);
            }
            else if (reachable || IsPortAvailable(session.port))
            {
                // Una respuesta HTTP demuestra que el registro ya no representa
                // a ese servidor; un puerto libre demuestra que quedó huérfano.
                DeleteRecord(file);
            }
            else
            {
                // Si el puerto sigue ocupado pero no responde, conservar el
                // registro obliga a cerrar con seguridad en vez de pisar el PID.
                sessions.Add(session);
            }
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
        if (!IsValidRecord(session))
        {
            DeleteRecord(SessionPath(session == null ? "" : session.sessionId));
            return true;
        }

        if (!IsLiveSession(session))
        {
            if (!IsPortAvailable(session.port)) return false;
            DeleteRecord(SessionPath(session.sessionId));
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

        // El shutdown HTTP es asíncrono. La señal segura para reutilizar el
        // puerto es que ya acepte un listener nuevo, no sólo que una consulta
        // HTTP haya fallado por timeout.
        if (!WaitForPortAvailable(session.port)) return false;
        DeleteRecord(SessionPath(session.sessionId));
        return true;
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
        Log("start-new-session");
        string script = Path.Combine(applicationRoot, "scripts", "open-solara.ps1");
        if (!File.Exists(script))
        {
            error = "No se encontró scripts\\open-solara.ps1.";
            Log("launcher-missing-script");
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

        List<string> existingSessionIds = new List<string>();
        foreach (SessionRecord session in DiscoverSessions())
        {
            existingSessionIds.Add(session.sessionId);
        }

        try
        {
            using (Process process = Process.Start(start))
            {
                StringBuilder outputBuilder = new StringBuilder();
                StringBuilder stderrBuilder = new StringBuilder();
                process.OutputDataReceived += delegate(object sender, DataReceivedEventArgs args)
                {
                    if (args.Data != null) outputBuilder.AppendLine(args.Data);
                };
                process.ErrorDataReceived += delegate(object sender, DataReceivedEventArgs args)
                {
                    if (args.Data != null) stderrBuilder.AppendLine(args.Data);
                };
                process.BeginOutputReadLine();
                process.BeginErrorReadLine();

                if (!process.WaitForExit(120000))
                {
                    try { process.Kill(); }
                    catch { }
                    CloseSessionsCreatedSince(existingSessionIds);
                    error = "El launcher no respondió dentro de 120 segundos.";
                    Log("launcher-timeout");
                    return null;
                }

                // WaitForExit(timeout) no espera el EOF de los streams. Un breve
                // margen permite entregar la última línea sin bloquearse por los
                // handles heredados del proceso Node persistente.
                Thread.Sleep(150);
                string output = outputBuilder.ToString();
                string stderr = stderrBuilder.ToString();
                Log("launcher-exit=" + process.ExitCode.ToString(CultureInfo.InvariantCulture) +
                    " output=" + CompactLogDetail(output) + " stderr=" + CompactLogDetail(stderr));
                if (process.ExitCode != 0)
                {
                    string cleanError = StripAnsi((stderr + Environment.NewLine + output).Trim());
                    error = string.IsNullOrWhiteSpace(cleanError)
                        ? "El launcher terminó con un error sin detalles (código " + process.ExitCode.ToString(CultureInfo.InvariantCulture) + ")."
                        : "El launcher terminó con un error: " + cleanError;
                    CloseSessionsCreatedSince(existingSessionIds);
                    return null;
                }

                string[] lines = output.Split(new[] { '\r', '\n' }, StringSplitOptions.RemoveEmptyEntries);
                if (lines.Length == 0)
                {
                    error = "El lanzador no devolvió la sesión creada.";
                    Log("launcher-empty-output");
                    CloseSessionsCreatedSince(existingSessionIds);
                    return null;
                }
                string payload = lines[lines.Length - 1].Trim().TrimStart('\uFEFF');
                LauncherResult result = json.Deserialize<LauncherResult>(payload);
                if (result == null)
                {
                    error = "El launcher devolvió una respuesta vacía.";
                    CloseSessionsCreatedSince(existingSessionIds);
                    return null;
                }
                if (string.IsNullOrWhiteSpace(result.sessionId) ||
                    result.sessionId.Length < 8 ||
                    result.sessionId.Length > 128 ||
                    result.port < 4173 ||
                    result.port > 4180 ||
                    string.IsNullOrWhiteSpace(result.url))
                {
                    error = "El launcher devolvió una sesión inválida.";
                    CloseSessionsCreatedSince(existingSessionIds);
                    return null;
                }
                Uri resultUri;
                if (!Uri.TryCreate(result.url, UriKind.Absolute, out resultUri) ||
                    resultUri.Scheme != Uri.UriSchemeHttp ||
                    resultUri.Host != "127.0.0.1" ||
                    resultUri.Port != result.port)
                {
                    error = "El launcher devolvió una URL local inválida.";
                    CloseSessionsCreatedSince(existingSessionIds);
                    return null;
                }
                return result;
            }
        }
        catch (Exception exception)
        {
            error = StripAnsi(exception.Message);
            if (string.IsNullOrWhiteSpace(error)) error = "No se pudo ejecutar el launcher.";
            Log("launcher-exception=" + CompactLogDetail(exception.ToString()));
            return null;
        }
    }

    private static string CompactLogDetail(string value)
    {
        if (string.IsNullOrEmpty(value)) return "<vacío>";
        return value.Replace("\r", " ").Replace("\n", " ").Trim();
    }

    private void CloseSessionsCreatedSince(List<string> existingSessionIds)
    {
        foreach (SessionRecord session in DiscoverSessions())
        {
            if (!existingSessionIds.Contains(session.sessionId)) CloseSession(session);
        }
    }

    public bool IsSessionLive(LauncherResult result)
    {
        if (result == null || string.IsNullOrWhiteSpace(result.sessionId)) return false;
        SessionRecord session = new SessionRecord();
        session.port = result.port;
        session.sessionId = result.sessionId;
        return IsLiveSession(session);
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
        SessionProbe probe;
        bool reachable;
        return TryGetSessionProbe(session, out probe, out reachable) &&
            probe.managed &&
            string.Equals(probe.sessionId, session.sessionId, StringComparison.Ordinal);
    }

    private bool TryGetSessionProbe(SessionRecord session, out SessionProbe probe, out bool reachable)
    {
        probe = null;
        reachable = false;
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
                reachable = true;
                if ((int)response.StatusCode != 200) return false;
                probe = json.Deserialize<SessionProbe>(reader.ReadToEnd());
                return probe != null;
            }
        }
        catch
        {
            return false;
        }
    }

    private static bool IsPortAvailable(int port)
    {
        TcpListener listener = null;
        try
        {
            listener = new TcpListener(IPAddress.Loopback, port);
            listener.Start();
            return true;
        }
        catch
        {
            return false;
        }
        finally
        {
            if (listener != null)
            {
                try { listener.Stop(); }
                catch { }
            }
        }
    }

    private static bool WaitForPortAvailable(int port)
    {
        for (int attempt = 0; attempt < 150; attempt++)
        {
            if (IsPortAvailable(port)) return true;
            Thread.Sleep(200);
        }
        return false;
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
    private readonly Control dispatcher;
    private readonly System.Windows.Forms.Timer refreshTimer;
    private readonly Mutex mutex;
    private readonly int initialSessionCount;
    private List<SessionRecord> sessions = new List<SessionRecord>();
    private bool restartInProgress;
    private bool startupInProgress;
    private bool closeInProgress;
    private bool exitInProgress;

    public TrayApplicationContext(string applicationRoot, Mutex ownedMutex, int reopenSessionCount)
    {
        mutex = ownedMutex;
        services = new TrayServices(applicationRoot);
        initialSessionCount = reopenSessionCount < 1 ? 1 : Math.Min(reopenSessionCount, 8);
        menu = new ContextMenuStrip();
        menu.ShowImageMargin = false;
        menu.Opening += delegate { RefreshMenu(); };

        dispatcher = new Control();
        dispatcher.CreateControl();
        if (!dispatcher.IsHandleCreated) dispatcher.Handle.ToInt64();
        services.Log("tray-context-created");

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
            services.Log("tray-startup-no-sessions");
            StartSessionsInBackground(initialSessionCount);
        }
    }

    private void StartSessionsInBackground(int sessionCount)
    {
        if (restartInProgress || startupInProgress || closeInProgress || exitInProgress) return;
        startupInProgress = true;
        RefreshMenu();

        ThreadPool.QueueUserWorkItem(delegate
        {
            List<LauncherResult> launched = new List<LauncherResult>();
            string error = "";
            services.Log("startup-worker-begin count=" + sessionCount.ToString(CultureInfo.InvariantCulture));
            try
            {
                for (int index = 0; index < sessionCount; index++)
                {
                    string launchError;
                    LauncherResult result = services.StartNewSession(out launchError);
                    if (result == null)
                    {
                        error = string.IsNullOrWhiteSpace(launchError)
                            ? "El launcher no devolvió detalles."
                            : launchError;
                        break;
                    }
                    launched.Add(result);
                    if (!services.IsSessionLive(result))
                    {
                        error = "El launcher informó una sesión, pero no quedó activa.";
                        break;
                    }
                }
            }
            catch (Exception exception)
            {
                error = string.IsNullOrWhiteSpace(exception.Message)
                    ? "No se pudo iniciar la sesión local."
                    : exception.Message;
            }

            services.Log("startup-worker-end launched=" + launched.Count.ToString(CultureInfo.InvariantCulture) +
                " error=" + (string.IsNullOrWhiteSpace(error) ? "<vacío>" : error));

            if (!string.IsNullOrWhiteSpace(error))
            {
                CloseLaunchedSessions(launched);
            }

            PostSessionLaunch(launched, error);
        });
    }

    private void CloseLaunchedSessions(List<LauncherResult> launched)
    {
        foreach (LauncherResult result in launched)
        {
            SessionRecord target = services.DiscoverSessions().Find(delegate(SessionRecord session)
            {
                return string.Equals(session.sessionId, result.sessionId, StringComparison.Ordinal);
            });
            if (target != null) services.CloseSession(target);
        }
    }

    private void PostSessionLaunch(List<LauncherResult> launched, string error)
    {
        try
        {
            dispatcher.BeginInvoke((MethodInvoker)delegate
            {
                startupInProgress = false;
                if (string.IsNullOrWhiteSpace(error))
                {
                    foreach (LauncherResult result in launched)
                    {
                        try
                        {
                            TrayServices.OpenUrl(result.url);
                        }
                        catch (Exception exception)
                        {
                            MessageBox.Show("La sesión inició, pero no se pudo abrir el navegador: " + exception.Message, "SolaraCommerce", MessageBoxButtons.OK, MessageBoxIcon.Warning);
                        }
                    }
                }
                else
                {
                    MessageBox.Show("No se pudo abrir SolaraCommerce: " + error, "SolaraCommerce", MessageBoxButtons.OK, MessageBoxIcon.Error);
                }
                RefreshMenu();
            });
        }
        catch
        {
            // La bandeja puede estar cerrándose en paralelo; las sesiones
            // parciales ya fueron cerradas antes de llegar aquí.
            services.Log("startup-callback-unavailable");
        }
    }

    private void RefreshSessions()
    {
        if (restartInProgress || startupInProgress || closeInProgress || exitInProgress) return;
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

        if (restartInProgress)
        {
            ToolStripMenuItem status = new ToolStripMenuItem("Reiniciando…");
            status.Enabled = false;
            menu.Items.Add(status);
            return;
        }

        if (startupInProgress)
        {
            ToolStripMenuItem status = new ToolStripMenuItem("Abriendo sesión…");
            status.Enabled = false;
            menu.Items.Add(status);
            return;
        }

        if (closeInProgress)
        {
            ToolStripMenuItem status = new ToolStripMenuItem("Cerrando sesión…");
            status.Enabled = false;
            menu.Items.Add(status);
            return;
        }

        if (exitInProgress)
        {
            ToolStripMenuItem status = new ToolStripMenuItem("Cerrando…");
            status.Enabled = false;
            menu.Items.Add(status);
            return;
        }

        ToolStripMenuItem newSession = new ToolStripMenuItem("Abrir nueva sesión");
        newSession.Click += delegate
        {
            StartSessionsInBackground(1);
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
            close.Click += delegate { CloseSessionInBackground(captured); };
            sessionItem.DropDownItems.Add(open);
            sessionItem.DropDownItems.Add(close);
            menu.Items.Add(sessionItem);
            index++;
        }

        menu.Items.Add(new ToolStripSeparator());
        ToolStripMenuItem closeAll = new ToolStripMenuItem("Cerrar todas");
        closeAll.Enabled = sessions.Count > 0;
        closeAll.Click += delegate { CloseAllInBackground(); };
        menu.Items.Add(closeAll);

        ToolStripMenuItem restart = new ToolStripMenuItem("Reiniciar aplicación");
        restart.Click += delegate { RestartApplication(); };
        menu.Items.Add(restart);

        ToolStripMenuItem exit = new ToolStripMenuItem("Salir");
        exit.Click += delegate { ExitTray(); };
        menu.Items.Add(exit);
    }

    private void CloseSessionInBackground(SessionRecord session)
    {
        if (restartInProgress || startupInProgress || closeInProgress || exitInProgress) return;
        closeInProgress = true;
        refreshTimer.Stop();
        RefreshMenu();

        ThreadPool.QueueUserWorkItem(delegate
        {
            string error = "";
            try
            {
                if (!services.CloseSession(session)) error = "No se pudo cerrar esa sesión de forma segura.";
            }
            catch (Exception exception)
            {
                error = string.IsNullOrWhiteSpace(exception.Message)
                    ? "No se pudo cerrar esa sesión de forma segura."
                    : exception.Message;
            }
            PostCloseResult(error);
        });
    }

    private void CloseAllInBackground()
    {
        if (restartInProgress || startupInProgress || closeInProgress || exitInProgress) return;
        closeInProgress = true;
        refreshTimer.Stop();
        RefreshMenu();

        ThreadPool.QueueUserWorkItem(delegate
        {
            string error = "";
            try
            {
                int failures = services.CloseAll();
                if (failures > 0 || services.DiscoverSessions().Count > 0)
                    error = "Quedaron sesiones activas que no pudieron cerrarse de forma segura.";
            }
            catch (Exception exception)
            {
                error = string.IsNullOrWhiteSpace(exception.Message)
                    ? "No se pudieron cerrar las sesiones de forma segura."
                    : exception.Message;
            }
            PostCloseResult(error);
        });
    }

    private void PostCloseResult(string error)
    {
        try
        {
            dispatcher.BeginInvoke((MethodInvoker)delegate
            {
                closeInProgress = false;
                refreshTimer.Start();
                RefreshMenu();
                if (!string.IsNullOrWhiteSpace(error))
                    MessageBox.Show(error, "SolaraCommerce", MessageBoxButtons.OK, MessageBoxIcon.Error);
            });
        }
        catch
        {
        }
    }

    private void RestartApplication()
    {
        if (restartInProgress || startupInProgress || closeInProgress || exitInProgress) return;
        restartInProgress = true;
        refreshTimer.Stop();
        RefreshMenu();

        ThreadPool.QueueUserWorkItem(delegate
        {
            try
            {
                int sessionCount = services.DiscoverSessions().Count;
                if (sessionCount < 1) sessionCount = 1;

                int closeFailures = services.CloseAll();
                if (closeFailures > 0 || services.DiscoverSessions().Count > 0)
                {
                    PostRestartFailure("No se pudieron cerrar todas las sesiones activas de forma segura.");
                    return;
                }

                string executablePath = Application.ExecutablePath;
                string workingDirectory = Path.GetDirectoryName(executablePath);
                ProcessStartInfo start = new ProcessStartInfo();
                start.FileName = executablePath;
                start.Arguments = "--restart-after-exit " + Process.GetCurrentProcess().Id.ToString(CultureInfo.InvariantCulture) +
                    " --reopen-sessions " + sessionCount.ToString(CultureInfo.InvariantCulture) +
                    " --root " + QuoteArgument(services.ApplicationRoot);
                start.WorkingDirectory = string.IsNullOrEmpty(workingDirectory) ? services.ApplicationRoot : workingDirectory;
                start.UseShellExecute = true;
                start.CreateNoWindow = true;
                Process replacement = Process.Start(start);
                if (replacement == null) throw new InvalidOperationException("Windows no devolvió la nueva instancia del tray.");

                dispatcher.BeginInvoke((MethodInvoker)delegate
                {
                    DisposeTray();
                    ExitThread();
                });
            }
            catch (Exception exception)
            {
                PostRestartFailure(exception.Message);
            }
        });
    }

    private void PostRestartFailure(string error)
    {
        try
        {
            dispatcher.BeginInvoke((MethodInvoker)delegate
            {
                restartInProgress = false;
                refreshTimer.Start();
                RefreshMenu();
                string detail = string.IsNullOrWhiteSpace(error) ? "No se recibió el motivo del fallo." : error;
                MessageBox.Show("No se pudo reiniciar la aplicación: " + detail, "SolaraCommerce", MessageBoxButtons.OK, MessageBoxIcon.Error);
            });
        }
        catch
        {
            // La bandeja puede estar cerrándose en paralelo; no hay UI que restaurar.
        }
    }

    private void ExitTray()
    {
        if (restartInProgress || startupInProgress || closeInProgress || exitInProgress) return;
        exitInProgress = true;
        refreshTimer.Stop();
        RefreshMenu();

        ThreadPool.QueueUserWorkItem(delegate
        {
            int failures = services.CloseAll();
            bool remaining = services.DiscoverSessions().Count > 0;
            if (failures > 0 || remaining)
            {
                try
                {
                    dispatcher.BeginInvoke((MethodInvoker)delegate
                    {
                        exitInProgress = false;
                        refreshTimer.Start();
                        RefreshMenu();
                        MessageBox.Show("No se puede salir mientras queden sesiones activas.", "SolaraCommerce", MessageBoxButtons.OK, MessageBoxIcon.Error);
                    });
                }
                catch
                {
                }
                return;
            }

            try
            {
                dispatcher.BeginInvoke((MethodInvoker)delegate
                {
                    DisposeTray();
                    ExitThread();
                });
            }
            catch
            {
            }
        });
    }

    private void DisposeTray()
    {
        refreshTimer.Stop();
        icon.Visible = false;
        icon.Dispose();
        menu.Dispose();
        dispatcher.Dispose();
        mutex.ReleaseMutex();
        mutex.Dispose();
    }

    private static string QuoteArgument(string value)
    {
        return "\"" + value.Replace("\"", "\\\"") + "\"";
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
        int restartAfterExitProcessId = 0;
        bool restartAfterExit = false;
        int reopenSessionCount = 1;

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
            else if ((args[index] == "--restart-after-exit" || args[index] == "--wait-for-exit") && index + 1 < args.Length)
            {
                restartAfterExit = true;
                int.TryParse(args[++index], NumberStyles.Integer, CultureInfo.InvariantCulture, out restartAfterExitProcessId);
            }
            else if (args[index] == "--reopen-sessions" && index + 1 < args.Length)
            {
                int.TryParse(args[++index], NumberStyles.Integer, CultureInfo.InvariantCulture, out reopenSessionCount);
            }
        }

        if (restartAfterExit && restartAfterExitProcessId > 0)
        {
            if (!WaitForProcessExit(restartAfterExitProcessId))
            {
                MessageBox.Show("La bandeja anterior no terminó a tiempo; el reinicio fue cancelado.", "SolaraCommerce", MessageBoxButtons.OK, MessageBoxIcon.Error);
                return 1;
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
            try
            {
                createdNew = restartAfterExit
                    ? WaitForMutex(mutex)
                    : mutex.WaitOne(0);
            }
            catch (AbandonedMutexException)
            {
                // Un cierre forzado puede dejar el nombre existente aunque ya
                // no haya una bandeja viva. En ese caso este proceso recupera
                // la propiedad en lugar de mostrar un falso "ya está abierto".
                createdNew = true;
            }
        }
        if (!createdNew)
        {
            mutex.Dispose();
            string message = restartAfterExit
                ? "No se pudo tomar el control de la bandeja después de esperar al proceso anterior."
                : "SolaraCommerce ya está abierto en la bandeja.";
            MessageBox.Show(message, "SolaraCommerce", MessageBoxButtons.OK, restartAfterExit ? MessageBoxIcon.Error : MessageBoxIcon.Information);
            return restartAfterExit ? 1 : 0;
        }

        try
        {
            Application.EnableVisualStyles();
            Application.SetCompatibleTextRenderingDefault(false);
            Application.Run(new TrayApplicationContext(applicationRoot, mutex, reopenSessionCount));
            return 0;
        }
        catch (Exception exception)
        {
            try { mutex.ReleaseMutex(); }
            catch { }
            string detail = exception.Message;
            if (string.IsNullOrWhiteSpace(detail)) detail = "Error inesperado al iniciar la bandeja.";
            MessageBox.Show("No se pudo iniciar SolaraCommerce: " + detail, "SolaraCommerce", MessageBoxButtons.OK, MessageBoxIcon.Error);
            return 1;
        }
    }

    private static bool WaitForProcessExit(int processId)
    {
        try
        {
            using (Process process = Process.GetProcessById(processId))
            {
                if (process.HasExited) return true;
                return process.WaitForExit(60000);
            }
        }
        catch (ArgumentException)
        {
            return true;
        }
        catch { return false; }
    }

    private static bool WaitForMutex(Mutex mutex)
    {
        for (int attempt = 0; attempt < 30; attempt++)
        {
            if (mutex.WaitOne(1000)) return true;
        }
        return false;
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
