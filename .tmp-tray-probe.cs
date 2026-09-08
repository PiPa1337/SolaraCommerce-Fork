using System;

internal static class TrayProbe
{
    private static int Main(string[] args)
    {
        TrayServices services = new TrayServices(args.Length > 0 ? args[0] : ".");
        string error;
        LauncherResult result = services.StartNewSession(out error);
        if (result == null)
        {
            Console.WriteLine("null|" + error);
            return 1;
        }

        Console.WriteLine("ok|" + result.sessionId + "|" + result.port + "|" + result.url);
        int failures = services.CloseAll();
        Console.WriteLine("close-failures=" + failures);
        return failures == 0 ? 0 : 1;
    }
}
