using System;
using System.Collections.Generic;
using System.IO;
using System.Security.Cryptography;
using System.Runtime.InteropServices;
using System.Text;

internal static class JobLauncher
{
    private const uint CREATE_SUSPENDED = 0x00000004;
    private const uint CREATE_NO_WINDOW = 0x08000000;
    private const uint JOB_OBJECT_LIMIT_KILL_ON_JOB_CLOSE = 0x00002000;
    private const int JobObjectExtendedLimitInformation = 9;
    private const uint WAIT_OBJECT_0 = 0;
    private const uint SYNCHRONIZE = 0x00100000;
    private const uint INFINITE = 0xffffffff;
    private const uint GENERIC_READ = 0x80000000;
    private const uint FILE_SHARE_READ = 1, FILE_SHARE_WRITE = 2, FILE_SHARE_DELETE = 4;
    private const uint OPEN_EXISTING = 3;
    private const uint FILE_FLAG_BACKUP_SEMANTICS = 0x02000000;
    private static readonly IntPtr INVALID_HANDLE_VALUE = new IntPtr(-1);

    [StructLayout(LayoutKind.Sequential)] private struct BasicLimits
    {
        public long PerProcessUserTimeLimit, PerJobUserTimeLimit;
        public uint LimitFlags;
        public UIntPtr MinimumWorkingSetSize, MaximumWorkingSetSize;
        public uint ActiveProcessLimit;
        public UIntPtr Affinity;
        public uint PriorityClass, SchedulingClass;
    }
    [StructLayout(LayoutKind.Sequential)] private struct IoCounters
    {
        public ulong ReadOperationCount, WriteOperationCount, OtherOperationCount;
        public ulong ReadTransferCount, WriteTransferCount, OtherTransferCount;
    }
    [StructLayout(LayoutKind.Sequential)] private struct ExtendedLimits
    {
        public BasicLimits BasicLimitInformation;
        public IoCounters IoInfo;
        public UIntPtr ProcessMemoryLimit, JobMemoryLimit, PeakProcessMemoryUsed, PeakJobMemoryUsed;
    }
    [StructLayout(LayoutKind.Sequential, CharSet = CharSet.Unicode)] private struct StartupInfo
    {
        public uint cb;
        public string lpReserved, lpDesktop, lpTitle;
        public uint dwX, dwY, dwXSize, dwYSize, dwXCountChars, dwYCountChars, dwFillAttribute, dwFlags;
        public ushort wShowWindow, cbReserved2;
        public IntPtr lpReserved2, hStdInput, hStdOutput, hStdError;
    }
    [StructLayout(LayoutKind.Sequential)] private struct ProcessInfo
    {
        public IntPtr hProcess, hThread;
        public uint dwProcessId, dwThreadId;
    }
    [StructLayout(LayoutKind.Sequential, CharSet = CharSet.Unicode)] private struct FindData
    {
        public uint Attributes;
        public System.Runtime.InteropServices.ComTypes.FILETIME CreationTime, LastAccessTime, LastWriteTime;
        public uint FileSizeHigh, FileSizeLow, Reserved0, Reserved1;
        [MarshalAs(UnmanagedType.ByValTStr, SizeConst = 260)] public string FileName;
        [MarshalAs(UnmanagedType.ByValTStr, SizeConst = 14)] public string AlternateFileName;
    }

    [DllImport("kernel32.dll", CharSet = CharSet.Unicode, SetLastError = true)] private static extern IntPtr CreateJobObject(IntPtr attributes, string name);
    [DllImport("kernel32.dll", SetLastError = true)] private static extern bool SetInformationJobObject(IntPtr job, int infoClass, ref ExtendedLimits info, uint length);
    [DllImport("kernel32.dll", CharSet = CharSet.Unicode, SetLastError = true)] private static extern bool CreateProcess(string applicationName, StringBuilder commandLine, IntPtr processAttributes, IntPtr threadAttributes, bool inheritHandles, uint creationFlags, IntPtr environment, string currentDirectory, ref StartupInfo startupInfo, out ProcessInfo processInfo);
    [DllImport("kernel32.dll", SetLastError = true)] private static extern bool AssignProcessToJobObject(IntPtr job, IntPtr process);
    [DllImport("kernel32.dll", SetLastError = true)] private static extern uint ResumeThread(IntPtr thread);
    [DllImport("kernel32.dll", SetLastError = true)] private static extern uint WaitForSingleObject(IntPtr handle, uint milliseconds);
    [DllImport("kernel32.dll", SetLastError = true)] private static extern uint WaitForMultipleObjects(uint count, IntPtr[] handles, bool waitAll, uint milliseconds);
    [DllImport("kernel32.dll", SetLastError = true)] private static extern IntPtr OpenProcess(uint access, bool inheritHandle, uint processId);
    [DllImport("kernel32.dll", SetLastError = true)] private static extern bool TerminateJobObject(IntPtr job, uint exitCode);
    [DllImport("kernel32.dll", SetLastError = true)] private static extern bool GetExitCodeProcess(IntPtr process, out uint exitCode);
    [DllImport("kernel32.dll", SetLastError = true)] private static extern bool TerminateProcess(IntPtr process, uint exitCode);
    [DllImport("kernel32.dll", SetLastError = true)] private static extern bool CloseHandle(IntPtr handle);
    [DllImport("kernel32.dll", CharSet = CharSet.Unicode, SetLastError = true)] private static extern IntPtr CreateFile(string fileName, uint access, uint share, IntPtr security, uint creation, uint flags, IntPtr template);
    [DllImport("kernel32.dll", CharSet = CharSet.Unicode, SetLastError = true)] private static extern uint GetFinalPathNameByHandle(IntPtr handle, StringBuilder path, uint length, uint flags);
    [DllImport("kernel32.dll", CharSet = CharSet.Unicode, SetLastError = true)] private static extern IntPtr FindFirstFile(string path, out FindData data);
    [DllImport("kernel32.dll", CharSet = CharSet.Unicode, SetLastError = true)] private static extern bool FindNextFile(IntPtr find, out FindData data);
    [DllImport("kernel32.dll", SetLastError = true)] private static extern bool FindClose(IntPtr find);
    [DllImport("kernel32.dll", CharSet = CharSet.Unicode, SetLastError = true)] private static extern uint GetFileAttributes(string path);

    private static string Quote(string value)
    {
        var result = new StringBuilder("\"");
        int slashes = 0;
        foreach (char c in value)
        {
            if (c == '\\') { slashes++; continue; }
            if (c == '"') { result.Append('\\', slashes * 2 + 1).Append('"'); slashes = 0; continue; }
            result.Append('\\', slashes).Append(c); slashes = 0;
        }
        result.Append('\\', slashes * 2).Append('"');
        return result.ToString();
    }

    private sealed class Entry
    {
        public char Kind;
        public string Hash;
        public string Target;
        public string Path;
    }

    private static string Extended(string fullPath)
    {
        if (fullPath.StartsWith("\\\\?\\", StringComparison.Ordinal)) return fullPath;
        if (fullPath.StartsWith("\\\\", StringComparison.Ordinal)) return "\\\\?\\UNC\\" + fullPath.Substring(2);
        return "\\\\?\\" + fullPath;
    }

    private static string NormalizeRelative(string value, bool allowParents)
    {
        if (String.IsNullOrEmpty(value) || value.StartsWith("/", StringComparison.Ordinal) || value.StartsWith("\\", StringComparison.Ordinal)
            || value.IndexOf('\\') >= 0 || value.IndexOf(':') >= 0) return null;
        var parts = new List<string>();
        foreach (string part in value.Split('/'))
        {
            if (part.Length == 0 || part == ".") return null;
            if (part == "..")
            {
                if (!allowParents || parts.Count == 0) return null;
                parts.RemoveAt(parts.Count - 1);
                continue;
            }
            foreach (char c in part) if (c < 32 || c == '\t') return null;
            parts.Add(part);
        }
        return String.Join("\\", parts.ToArray());
    }

    private static string ExpectedLinkTarget(string root, string linkPath, string relativeTarget)
    {
        if (String.IsNullOrEmpty(relativeTarget) || relativeTarget.StartsWith("/", StringComparison.Ordinal)
            || relativeTarget.StartsWith("\\", StringComparison.Ordinal) || relativeTarget.IndexOf('\\') >= 0 || relativeTarget.IndexOf(':') >= 0) return null;
        var parts = new List<string>(Path.GetDirectoryName(linkPath).Substring(root.TrimEnd('\\').Length).TrimStart('\\').Split(new char[] { '\\' }, StringSplitOptions.RemoveEmptyEntries));
        foreach (string part in relativeTarget.Split('/'))
        {
            if (part.Length == 0 || part == ".") return null;
            if (part == "..") { if (parts.Count == 0) return null; parts.RemoveAt(parts.Count - 1); }
            else { foreach (char c in part) if (c < 32 || c == '\t') return null; parts.Add(part); }
        }
        return parts.Count == 0 ? root : Path.Combine(root, String.Join("\\", parts.ToArray()));
    }

    private static string FinalPath(string path)
    {
        IntPtr handle = CreateFile(Extended(path), GENERIC_READ, FILE_SHARE_READ | FILE_SHARE_WRITE | FILE_SHARE_DELETE,
            IntPtr.Zero, OPEN_EXISTING, FILE_FLAG_BACKUP_SEMANTICS, IntPtr.Zero);
        if (handle == INVALID_HANDLE_VALUE) return null;
        try
        {
            StringBuilder value = new StringBuilder(32768);
            uint length = GetFinalPathNameByHandle(handle, value, (uint)value.Capacity, 0);
            if (length == 0 || length >= value.Capacity) return null;
            string result = value.ToString();
            if (result.StartsWith("\\\\?\\UNC\\", StringComparison.OrdinalIgnoreCase)) return "\\\\" + result.Substring(8);
            if (result.StartsWith("\\\\?\\", StringComparison.Ordinal)) return result.Substring(4);
            return result;
        }
        finally { CloseHandle(handle); }
    }

    private static bool VerifyRuntime(string rootPath, string manifestPath)
    {
        string root = Path.GetFullPath(rootPath).TrimEnd('\\');
        string manifest = File.ReadAllText(manifestPath, new UTF8Encoding(false, true));
        string[] lines = manifest.Split(new char[] { '\r', '\n' }, StringSplitOptions.RemoveEmptyEntries);
        if (lines.Length < 1 || lines[0] != "BOSTAN_RUNTIME_PAYLOAD_V1") return false;
        var expected = new Dictionary<string, Entry>(StringComparer.OrdinalIgnoreCase);
        for (int i = 1; i < lines.Length; i++)
        {
            string[] fields = lines[i].Split(new char[] { '\t' });
            if (fields.Length != 3 || fields[0].Length != 1) return false;
            string relative = NormalizeRelative(fields[2], false);
            if (relative == null) return false;
            var entry = new Entry { Kind = fields[0][0], Path = relative };
            if (entry.Kind == 'F')
            {
                if (fields[1].Length != 64) return false;
                foreach (char c in fields[1]) if (!Uri.IsHexDigit(c)) return false;
                entry.Hash = fields[1].ToLowerInvariant();
            }
            else if (entry.Kind == 'L')
            {
                entry.Target = fields[1];
                if (ExpectedLinkTarget(root, Path.Combine(root, relative), entry.Target) == null) return false;
            }
            else return false;
            if (expected.ContainsKey(relative)) return false;
            expected.Add(relative, entry);
        }
        if (expected.Count == 0) return false;

        var actual = new Dictionary<string, Entry>(StringComparer.OrdinalIgnoreCase);
        var pending = new Stack<string>(); pending.Push(root);
        while (pending.Count > 0)
        {
            string directory = pending.Pop();
            foreach (string name in DirectoryEntries(directory))
            {
                string relative = Path.Combine(directory, name).Substring(root.Length + 1).Replace('\\', '/');
                relative = NormalizeRelative(relative, false);
                if (relative == null || actual.ContainsKey(relative)) return false;
                uint rawAttributes = GetFileAttributes(Extended(Path.Combine(directory, name)));
                if (rawAttributes == 0xffffffff) return false;
                FileAttributes attributes = (FileAttributes)rawAttributes;
                if ((attributes & FileAttributes.ReparsePoint) != 0)
                {
                    actual.Add(relative, new Entry { Kind = 'L', Path = relative });
                }
                else if ((attributes & FileAttributes.Directory) != 0) pending.Push(Path.Combine(directory, name));
                else if ((attributes & FileAttributes.Device) != 0) return false;
                else actual.Add(relative, new Entry { Kind = 'F', Path = relative, Hash = HashFile(Path.Combine(directory, name)) });
            }
        }
        if (actual.Count != expected.Count) return false;
        foreach (KeyValuePair<string, Entry> pair in expected)
        {
            Entry seen;
            if (!actual.TryGetValue(pair.Key, out seen) || seen.Kind != pair.Value.Kind) return false;
            if (seen.Kind == 'F' && seen.Hash != pair.Value.Hash) return false;
            if (seen.Kind == 'L')
            {
                string expectedTarget = ExpectedLinkTarget(root, Path.Combine(root, pair.Value.Path), pair.Value.Target);
                string actualTarget = FinalPath(Path.Combine(root, pair.Value.Path));
                string canonicalExpected = FinalPath(expectedTarget);
                if (actualTarget == null || canonicalExpected == null || !String.Equals(actualTarget, canonicalExpected, StringComparison.OrdinalIgnoreCase)) return false;
            }
        }
        return true;
    }

    private static string HashFile(string path)
    {
        IntPtr handle = CreateFile(Extended(path), GENERIC_READ, FILE_SHARE_READ | FILE_SHARE_WRITE | FILE_SHARE_DELETE,
            IntPtr.Zero, OPEN_EXISTING, 0, IntPtr.Zero);
        if (handle == INVALID_HANDLE_VALUE) throw new IOException("Unable to read runtime file", new System.ComponentModel.Win32Exception(Marshal.GetLastWin32Error()));
        using (Microsoft.Win32.SafeHandles.SafeFileHandle safe = new Microsoft.Win32.SafeHandles.SafeFileHandle(handle, true))
        using (SHA256 hash = SHA256.Create())
        using (FileStream stream = new FileStream(safe, FileAccess.Read))
        {
            byte[] bytes = hash.ComputeHash(stream);
            var result = new StringBuilder(bytes.Length * 2);
            foreach (byte b in bytes) result.Append(b.ToString("x2"));
            return result.ToString();
        }
    }

    private static IEnumerable<string> DirectoryEntries(string directory)
    {
        FindData data;
        IntPtr find = FindFirstFile(Extended(directory.TrimEnd('\\') + "\\*"), out data);
        if (find == INVALID_HANDLE_VALUE)
        {
            int error = Marshal.GetLastWin32Error();
            if (error == 2 || error == 18) yield break;
            throw new IOException("Unable to enumerate runtime directory", new System.ComponentModel.Win32Exception(error));
        }
        try
        {
            do
            {
                if (data.FileName != "." && data.FileName != "..") yield return data.FileName;
            } while (FindNextFile(find, out data));
            int error = Marshal.GetLastWin32Error();
            if (error != 18) throw new IOException("Runtime directory enumeration failed", new System.ComponentModel.Win32Exception(error));
        }
        finally { FindClose(find); }
    }

    private static int Main(string[] args)
    {
        if (args.Length != 4) return 64;
        IntPtr job = IntPtr.Zero;
        IntPtr owner = IntPtr.Zero;
        ProcessInfo child = new ProcessInfo();
        try
        {
            uint ownerPid;
            if (!UInt32.TryParse(args[3], out ownerPid) || ownerPid == 0) return 80;
            owner = OpenProcess(SYNCHRONIZE, false, ownerPid);
            if (owner == IntPtr.Zero) return 80;
            job = CreateJobObject(IntPtr.Zero, null);
            if (job == IntPtr.Zero) return 70;
            ExtendedLimits limits = new ExtendedLimits();
            limits.BasicLimitInformation.LimitFlags = JOB_OBJECT_LIMIT_KILL_ON_JOB_CLOSE;
            if (!SetInformationJobObject(job, JobObjectExtendedLimitInformation, ref limits, (uint)Marshal.SizeOf(typeof(ExtendedLimits)))) return 71;

            string tool = Path.Combine(AppDomain.CurrentDomain.BaseDirectory, "7za.exe");
            string archive = args[0], destination = args[1];
            string command = Quote(tool) + " x -y -bd -bso0 -bsp0 -bse0 " + Quote("-o" + destination) + " " + Quote(archive);
            StartupInfo startup = new StartupInfo();
            startup.cb = (uint)Marshal.SizeOf(typeof(StartupInfo));
            if (!CreateProcess(tool, new StringBuilder(command), IntPtr.Zero, IntPtr.Zero, false,
                    CREATE_SUSPENDED | CREATE_NO_WINDOW, IntPtr.Zero, null, ref startup, out child)) return 72;
            if (!AssignProcessToJobObject(job, child.hProcess))
            {
                TerminateProcess(child.hProcess, 73);
                WaitForSingleObject(child.hProcess, 5000);
                return 73;
            }
            if (ResumeThread(child.hThread) == 0xffffffff)
            {
                TerminateProcess(child.hProcess, 74);
                WaitForSingleObject(child.hProcess, 5000);
                return 74;
            }
            IntPtr[] waitHandles = new IntPtr[] { child.hProcess, owner };
            uint waited = WaitForMultipleObjects(2, waitHandles, false, INFINITE);
            if (waited == WAIT_OBJECT_0 + 1)
            {
                TerminateJobObject(job, 79);
                WaitForSingleObject(child.hProcess, INFINITE);
                return 79;
            }
            if (waited != WAIT_OBJECT_0) return 75;
            uint exitCode;
            if (!GetExitCodeProcess(child.hProcess, out exitCode)) return 76;
            if (exitCode != 0) return unchecked((int)exitCode);
            return VerifyRuntime(Path.Combine(destination, "resources", "runtime"), args[2]) ? 0 : 78;
        }
        catch { return 77; }
        finally
        {
            if (child.hThread != IntPtr.Zero) CloseHandle(child.hThread);
            if (child.hProcess != IntPtr.Zero) CloseHandle(child.hProcess);
            if (job != IntPtr.Zero) CloseHandle(job);
            if (owner != IntPtr.Zero) CloseHandle(owner);
        }
    }
}
