using System;
using System.Reflection;
using System.Threading;
using System.Windows.Forms;

internal static class TrayRestartProbe
{
    [STAThread]
    private static int Main(string[] args)
    {
        string root = args.Length > 0 ? args[0] : ".";
        MethodInfo buildMutexName = typeof(Program).GetMethod(
            "BuildMutexName",
            BindingFlags.Static | BindingFlags.NonPublic
        );
        string mutexName = (string)buildMutexName.Invoke(null, new object[] { root });
        bool createdNew;
        Mutex mutex = new Mutex(true, mutexName, out createdNew);
        if (!createdNew)
        {
            try { createdNew = mutex.WaitOne(0); }
            catch (AbandonedMutexException) { createdNew = true; }
        }
        if (!createdNew)
        {
            Console.WriteLine("probe-mutex-busy");
            return 2;
        }

        Application.EnableVisualStyles();
        Application.SetCompatibleTextRenderingDefault(false);
        TrayApplicationContext context = new TrayApplicationContext(root, mutex, 1);
        MethodInfo restart = typeof(TrayApplicationContext).GetMethod(
            "RestartApplication",
            BindingFlags.Instance | BindingFlags.NonPublic
        );
        System.Windows.Forms.Timer timer = new System.Windows.Forms.Timer();
        DateTime deadline = DateTime.UtcNow.AddSeconds(90);
        bool triggered = false;
        timer.Interval = 250;
        timer.Tick += delegate
        {
            if (!triggered && new TrayServices(root).DiscoverSessions().Count > 0)
            {
                triggered = true;
                Console.WriteLine("probe-trigger-restart");
                restart.Invoke(context, null);
            }
            if (DateTime.UtcNow > deadline)
            {
                Console.WriteLine("probe-timeout");
                timer.Stop();
                context.ExitThread();
            }
        };
        timer.Start();
        Application.Run(context);
        Console.WriteLine(triggered ? "probe-exit-after-restart" : "probe-exit-without-restart");
        return triggered ? 0 : 1;
    }
}
