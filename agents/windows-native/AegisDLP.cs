/* Назначение файла: Исходник Windows-приложения Aegis DLP: служба, сбор состояния, локальное подтверждение браузера, политики, трей и установка.
 * Карта проекта: SOURCE_GUIDE.md; обзор папки: FOLDER_GUIDE.md.
 */

// Aegis DLP native Windows agent. Built against the Windows .NET Framework.
// No downloaded code, remote shell, hidden installation or removal evasion.
using System;
using System.Collections;
using System.Collections.Generic;
using System.ComponentModel;
using System.Configuration.Install;
using System.Diagnostics;
using System.Drawing;
using System.IO;
using System.IO.Pipes;
using System.Linq;
using System.Net;
using System.Reflection;
using System.Security.AccessControl;
using System.Security.Cryptography;
using System.Security.Principal;
using System.ServiceProcess;
using System.Text;
using System.Threading;
using System.Web.Script.Serialization;
using System.Windows.Forms;
using Microsoft.Win32;

namespace AegisDLP {
  // Общие операции: JSON, локальное хранение с DPAPI, права файлов и HTTP-обмен с сервером.
  static class Data {
    public static string Root = Path.Combine(Environment.GetFolderPath(Environment.SpecialFolder.CommonApplicationData), "AegisDLP");
    public static string Private { get { return Path.Combine(Root, "Private"); } }
    public static string Bin { get { return Path.Combine(Environment.GetFolderPath(Environment.SpecialFolder.ProgramFiles), "AegisDLP"); } }
    public static string Json(object value) { return new JavaScriptSerializer().Serialize(value); }
    public static Dictionary<string, object> Parse(string value) { return new JavaScriptSerializer { MaxJsonLength = 2000000 }.Deserialize<Dictionary<string, object>>(value); }
    public static string Text(Dictionary<string, object> value, string key, string fallback = "") { return value.ContainsKey(key) && value[key] != null ? Convert.ToString(value[key]) : fallback; }
    public static int Number(Dictionary<string, object> value, string key, int fallback = 0) { return value.ContainsKey(key) && value[key] != null ? Convert.ToInt32(value[key]) : fallback; }
    public static string Hash(string value) { using (var h = SHA256.Create()) return BitConverter.ToString(h.ComputeHash(Encoding.UTF8.GetBytes(value))).Replace("-", "").ToLowerInvariant(); }
    public static byte[] Secret(byte[] input, bool decrypt) { return decrypt ? ProtectedData.Unprotect(input, null, DataProtectionScope.LocalMachine) : ProtectedData.Protect(input, null, DataProtectionScope.LocalMachine); }
    public static void Write(string path, object value, bool protect) {
      byte[] bytes = Encoding.UTF8.GetBytes(Json(value));
      if (protect) bytes = Secret(bytes, false);
      string temporary = path + ".tmp";
      File.WriteAllBytes(temporary, bytes);
      if (File.Exists(path)) File.Replace(temporary, path, null); else File.Move(temporary, path);
    }
    public static Dictionary<string, object> Read(string path, bool protect) {
      byte[] bytes = File.ReadAllBytes(path); if (protect) bytes = Secret(bytes, true);
      return Parse(Encoding.UTF8.GetString(bytes));
    }
    public static void Acl(string directory, bool readable) {
      Directory.CreateDirectory(directory);
      var acl = new DirectorySecurity(); acl.SetAccessRuleProtection(true, false);
      foreach (var identity in new[] { WellKnownSidType.LocalSystemSid, WellKnownSidType.BuiltinAdministratorsSid })
        acl.AddAccessRule(new FileSystemAccessRule(new SecurityIdentifier(identity, null), FileSystemRights.FullControl, InheritanceFlags.ContainerInherit | InheritanceFlags.ObjectInherit, PropagationFlags.None, AccessControlType.Allow));
      if (readable) acl.AddAccessRule(new FileSystemAccessRule(new SecurityIdentifier(WellKnownSidType.BuiltinUsersSid, null), FileSystemRights.ReadAndExecute, InheritanceFlags.ContainerInherit | InheritanceFlags.ObjectInherit, PropagationFlags.None, AccessControlType.Allow));
      new DirectoryInfo(directory).SetAccessControl(acl);
    }
    public static bool Admin { get { return new WindowsPrincipal(WindowsIdentity.GetCurrent()).IsInRole(WindowsBuiltInRole.Administrator); } }
    public static string PasswordHash(string password, byte[] salt) {
      using (var pbkdf = new Rfc2898DeriveBytes(password, salt, 150000, HashAlgorithmName.SHA256)) return Convert.ToBase64String(pbkdf.GetBytes(32));
    }
    public static bool Equal(string left, string right) {
      byte[] a = Encoding.UTF8.GetBytes(left), b = Encoding.UTF8.GetBytes(right);
      int diff = a.Length ^ b.Length; for (int i = 0; i < Math.Min(a.Length, b.Length); i++) diff |= a[i] ^ b[i]; return diff == 0;
    }
    public static Uri Endpoint(Dictionary<string, object> config) {
      Uri uri = new Uri(Text(config, "endpoint")); Guid id;
      if ((!uri.Scheme.Equals("https") && !(uri.Scheme.Equals("http") && uri.IsLoopback)) || !String.IsNullOrEmpty(uri.UserInfo) || !String.IsNullOrEmpty(uri.Query) || !String.IsNullOrEmpty(uri.Fragment) || !uri.AbsolutePath.StartsWith("/api/v1/dlp/agents/") || !Guid.TryParse(uri.Segments.Last(), out id)) throw new InvalidDataException("Invalid Aegis endpoint");
      return uri;
    }
    public static Dictionary<string, object> Post(Dictionary<string, object> config, string path, object body) {
      ServicePointManager.SecurityProtocol = SecurityProtocolType.Tls12;
      var request = (HttpWebRequest)WebRequest.Create(Endpoint(config).AbsoluteUri + path);
      request.Method = "POST"; request.ContentType = "application/json"; request.AllowAutoRedirect = false; request.Timeout = 20000; request.ReadWriteTimeout = 20000; request.Proxy = WebRequest.DefaultWebProxy;
      request.Headers["Authorization"] = "Bearer " + Text(config, "token");
      byte[] bytes = Encoding.UTF8.GetBytes(Json(body)); request.ContentLength = bytes.Length;
      using (var output = request.GetRequestStream()) output.Write(bytes, 0, bytes.Length);
      using (var response = (HttpWebResponse)request.GetResponse()) {
        if (response.StatusCode != HttpStatusCode.OK && response.StatusCode != HttpStatusCode.Created) throw new IOException("Unconfirmed response");
        using (var stream = new StreamReader(response.GetResponseStream())) {
          char[] buffer = new char[200001]; int count = stream.ReadBlock(buffer, 0, buffer.Length);
          if (count > 200000) throw new IOException("Oversized response");
          return Parse(new string(buffer, 0, count));
        }
      }
    }
    public static string PowerShell(string script, int timeout) {
      var start = new ProcessStartInfo(Path.Combine(Environment.GetFolderPath(Environment.SpecialFolder.System), @"WindowsPowerShell\v1.0\powershell.exe"));
      start.Arguments = "-NoLogo -NoProfile -NonInteractive -EncodedCommand " + Convert.ToBase64String(Encoding.Unicode.GetBytes(script));
      start.UseShellExecute = false; start.CreateNoWindow = true; start.RedirectStandardOutput = true; start.RedirectStandardError = true;
      start.StandardOutputEncoding = Encoding.UTF8; start.StandardErrorEncoding = Encoding.UTF8;
      using (var process = Process.Start(start)) {
        var output = process.StandardOutput.ReadToEndAsync(); var error = process.StandardError.ReadToEndAsync();
        if (!process.WaitForExit(timeout)) { process.Kill(); throw new System.TimeoutException("Windows operation timed out"); }
        if (process.ExitCode != 0) throw new IOException("Windows protection operation failed");
        return output.Result.TrimStart('\uFEFF');
      }
    }
    public static Dictionary<string, object> Collect() {
      using (var resource = Assembly.GetExecutingAssembly().GetManifestResourceStream("Aegis.Collect"))
      using (var reader = new StreamReader(resource)) return Parse(PowerShell(reader.ReadToEnd(), 60000));
    }
  }

  // Применение режима USB вынесено отдельно от сети и интерфейса: это изменение состояния Windows.
  static class UsbPolicy {
    const string Key = @"SOFTWARE\Policies\Microsoft\Windows\RemovableStorageDevices\{53f5630d-b6bf-11d0-94f2-00a0c91efb8b}";
    static readonly string[] Names = { "Deny_Read", "Deny_Write", "Deny_Execute" };
    public static void Apply(string mode) {
      string backup = Path.Combine(Data.Private, "usb-backup.dat");
      if (mode != "block" && mode != "restore" && mode != "audit") throw new InvalidDataException("Unknown USB policy");
      if (mode != "block" && !File.Exists(backup)) return;
      using (var root = RegistryKey.OpenBaseKey(RegistryHive.LocalMachine, RegistryView.Registry64))
      using (var key = root.CreateSubKey(Key)) {
        if (mode == "block") {
          if (!File.Exists(backup)) {
            var previous = new Dictionary<string, object>();
            foreach (string name in Names) {
              object value = key.GetValue(name);
              if (value != null && key.GetValueKind(name) != RegistryValueKind.DWord) throw new InvalidDataException("Unexpected existing USB policy type");
              previous[name] = value;
            }
            Data.Write(backup, previous, true);
          }
          foreach (string name in Names) key.SetValue(name, 1, RegistryValueKind.DWord);
        } else {
          var previous = Data.Read(backup, true);
          if (previous.Count != Names.Length || Names.Any(name => !previous.ContainsKey(name))) throw new InvalidDataException("Invalid USB backup");
          foreach (string name in Names) {
            if (previous[name] == null) key.DeleteValue(name, false); else key.SetValue(name, Convert.ToInt32(previous[name]), RegistryValueKind.DWord);
          }
          File.Delete(backup);
        }
      }
    }
  }

  // Рабочий цикл агента: собирает состояние, обменивается heartbeat и применяет полученные настройки.
  sealed class Worker {
    public readonly Dictionary<string, object> Config;
    readonly object sync = new object();
    readonly Dictionary<string, string> commands = new Dictionary<string, string>();
    readonly HashSet<string> sent = new HashSet<string>();
    public int PolicyVersion; public string PolicyError; public bool Connected;
    readonly bool serviceMode;
    int failures; DateTime blockedUntil;
    string Queue { get { return Path.Combine(Data.Private, "Queue"); } }
    public Worker(bool serviceMode = false, bool applyCached = true) {
      this.serviceMode=serviceMode;
      Config = Data.Read(Path.Combine(Data.Private, "config.dat"), true); Data.Endpoint(Config); Directory.CreateDirectory(Queue);
      string ledger = Path.Combine(Data.Private, "sent.dat");
      if (File.Exists(ledger)) foreach (string id in Data.Text(Data.Read(ledger, true), "ids").Split('\n')) sent.Add(id);
      string commandFile = Path.Combine(Data.Private, "commands.dat");
      if (File.Exists(commandFile)) foreach (var entry in Data.Read(commandFile, true)) commands[entry.Key] = Convert.ToString(entry.Value);
      string cached = Path.Combine(Data.Private, "policy.dat");
      if (applyCached && File.Exists(cached)) try { ApplyPolicy(Data.Read(cached, true)); } catch (Exception ex) { PolicyError = ex.GetType().Name; }
    }
    public string Signature(string json) {
      byte[] key; using (var sha = SHA256.Create()) key = sha.ComputeHash(Encoding.UTF8.GetBytes(Data.Text(Config, "token") + ":policy"));
      using (var hmac = new HMACSHA256(key)) return BitConverter.ToString(hmac.ComputeHash(Encoding.UTF8.GetBytes(json))).Replace("-", "").ToLowerInvariant();
    }
    public void ApplyPolicy(Dictionary<string, object> response) {
      string json = Data.Text(response, "policy_json");
      if (!Data.Equal(Signature(json), Data.Text(response, "policy_signature"))) throw new CryptographicException("Invalid policy signature");
      var policy = Data.Parse(json); int version = Data.Number(policy, "version");
      if (version < PolicyVersion) throw new InvalidDataException("Policy rollback rejected");
      if (version == PolicyVersion && PolicyError == null) return;
      // Persist the desired signed policy before applying: offline restart retries failures.
      Data.Write(Path.Combine(Data.Private, "policy.dat"), new { policy_json = json, policy_signature = Data.Text(response, "policy_signature") }, true);
      UsbPolicy.Apply(Data.Text(policy, "usb_mode")); PolicyVersion = version; PolicyError = null;
    }
    void Enqueue(Dictionary<string, object> value) {
      string id = Data.Text(value, "external_id"), file = Path.Combine(Queue, Data.Hash(id) + ".dat");
      if (sent.Contains(id) || File.Exists(file)) return;
      if (Directory.GetFiles(Queue, "*.dat").Length >= 10000) throw new IOException("Offline queue full");
      Data.Write(file, value, true);
    }
    void Record(Dictionary<string, object> snapshot) {
      string now = DateTime.UtcNow.ToString("o"), device = Environment.MachineName;
      // Live metrics travel in heartbeat; the durable queue keeps an hourly status.
      Enqueue(new Dictionary<string, object> { {"external_id", "native-status-" + Data.Hash(device + now.Substring(0,13))}, {"time",now}, {"device",device}, {"account","endpoint"}, {"source","Aegis DLP"}, {"type","endpoint_security_status"}, {"detail","Состояние службы Aegis DLP и защиты Windows"}, {"features", snapshot["status"]} });
      object value;
      if (!snapshot.TryGetValue("threats", out value) || !(value is IEnumerable)) return;
      foreach (object item in (IEnumerable)value) {
        var threat = item as Dictionary<string, object>; if (threat == null || Data.Text(threat,"time") == "" || Data.Text(threat,"id") == "") continue;
        string id = "native-threat-" + Data.Hash(device + Data.Text(threat,"id") + Data.Text(threat,"action_success"));
        Enqueue(new Dictionary<string, object> { {"external_id",id}, {"time",threat["time"]}, {"device",device}, {"account","endpoint"}, {"source","Aegis DLP"}, {"type","malware_detected"}, {"detail","Обнаружение Windows Defender; проверьте результат обработки"}, {"features",new { threat_id = Data.Text(threat,"threat_id"), action_success = threat.ContainsKey("action_success") && Convert.ToBoolean(threat["action_success"]) }} });
      }
    }
    void Deliver() {
      var files = Directory.GetFiles(Queue,"*.dat").OrderBy(p => p).Take(25).ToArray(); if (files.Length == 0) return;
      var batch = files.Select(p => Data.Read(p,true)).ToArray(); var ack = Data.Post(Config,"/events",batch);
      if (Data.Number(ack,"created") + Data.Number(ack,"duplicates") != batch.Length) throw new IOException("Incomplete acknowledgement");
      foreach (var entry in batch) sent.Add(Data.Text(entry,"external_id"));
      if(sent.Count>20000){var retained=sent.Skip(sent.Count-20000).ToArray();sent.Clear();foreach(string id in retained)sent.Add(id);}
      Data.Write(Path.Combine(Data.Private,"sent.dat"),new { ids=String.Join("\n",sent) },true);
      foreach (string file in files) File.Delete(file);
    }
    void Commands(Dictionary<string, object> response) {
      object list; if (!response.TryGetValue("commands",out list) || !(list is IEnumerable)) return;
      foreach (object item in (IEnumerable)list) {
        var command = item as Dictionary<string,object>; Guid guid;
        if (command == null || Data.Text(command,"action") != "quick_scan" || !Guid.TryParse(Data.Text(command,"id"),out guid)) continue;
        string id = Data.Text(command,"id");
        lock(sync) { if (commands.ContainsKey(id)) continue; if(commands.Count>=20)commands.Remove(commands.Keys.First());commands[id]="started"; SaveCommands(); }
        ThreadPool.QueueUserWorkItem(delegate {
          string result="completed";
          try { Data.PowerShell("$ErrorActionPreference='Stop'; Start-MpScan -ScanType QuickScan",1200000); } catch { result="failed"; }
          lock(sync) { commands[id]=result; SaveCommands(); }
        });
      }
    }
    void SaveCommands() { Data.Write(Path.Combine(Data.Private,"commands.dat"),commands,true); }
    public void Pair(string code, string source = "manual") { Data.Post(Config,"/pair",new { code=code.Trim().ToUpperInvariant(),source=source }); }
    public bool Unlock(string password) {
      lock(sync) {
        string file=Path.Combine(Data.Private,"login.dat");
        if (File.Exists(file)) { var state=Data.Read(file,true); failures=Data.Number(state,"failures"); DateTime.TryParse(Data.Text(state,"blocked_until"),out blockedUntil); }
        if (DateTime.UtcNow < blockedUntil.ToUniversalTime()) return false;
        bool valid=Data.Equal(Data.PasswordHash(password,Convert.FromBase64String(Data.Text(Config,"password_salt"))),Data.Text(Config,"password_hash"));
        failures=valid ? 0 : failures+1; blockedUntil=failures>=5 ? DateTime.UtcNow.AddMinutes(5) : DateTime.MinValue;
        Data.Write(file,new { failures=failures, blocked_until=blockedUntil.ToString("o") },true); return valid;
      }
    }
    public void Cycle(Dictionary<string,object> testSnapshot = null) {
      var snapshot = new Dictionary<string,object> { {"status", new Dictionary<string,object>()} }; bool collectionError=false; string error="";
      try { snapshot=testSnapshot ?? Data.Collect(); Record(snapshot); } catch(Exception ex) { collectionError=true; error=ex.GetType().Name; }
      int pending=Directory.GetFiles(Queue,"*.dat").Length;
      var payload=new Dictionary<string,object> { {"installation_id",Config["installation_id"]},{"hostname",Environment.MachineName},{"os",Environment.OSVersion.VersionString},{"status",snapshot["status"]},{"collection_error",collectionError},{"pending",pending},{"agent_version","2.0.0-native"},{"service_mode",serviceMode},{"policy_version",PolicyVersion},{"policy_error",PolicyError} };
      lock(sync) payload["command_results"]=new Dictionary<string,string>(commands);
      try {
        var response=Data.Post(Config,"/heartbeat",payload); Connected=true;
        try { ApplyPolicy(response); } catch(Exception ex) { PolicyError=ex.GetType().Name; }
        if (Data.Text(Config,"pairing_code")!="") { try { Pair(Data.Text(Config,"pairing_code"),"bootstrap"); } catch {} Config.Remove("pairing_code"); Data.Write(Path.Combine(Data.Private,"config.dat"),Config,true); }
        Commands(response); Deliver();
      } catch(Exception ex) { Connected=false; error=ex.GetType().Name; }
      Data.Write(Path.Combine(Data.Root,"status.json"),new { time=DateTime.UtcNow.ToString("o"),connected=Connected,policy_version=PolicyVersion,policy_error=PolicyError,error=error,pending=pending,version="2.0.0-native",panel_url=Data.Endpoint(Config).GetLeftPart(UriPartial.Authority)+"/app/dlp" },false);
    }
  }

  // Windows-служба продолжает работу без открытого окна и обслуживает локальное подтверждение браузера.
  sealed class AgentService : ServiceBase {
    readonly ManualResetEvent stop=new ManualResetEvent(false); Thread thread; Worker worker;
    public AgentService() { ServiceName="AegisDLP"; CanStop=true; AutoLog=true; }
    internal void TestBridge(Worker value) {
      worker=value;var local=new Thread(LocalBridge);local.IsBackground=true;local.Start();
      stop.WaitOne(6000);stop.Set();local.Join(3000);
    }
    protected override void OnStart(string[] args) {
      worker=new Worker(true); thread=new Thread(new ThreadStart(delegate { while (!stop.WaitOne(0)) { try { worker.Cycle(); } catch {} if(stop.WaitOne(30000))break; } })); thread.IsBackground=true;thread.Start();
      var pipeThread=new Thread(Pipes);pipeThread.IsBackground=true;pipeThread.Start();
      var localThread=new Thread(LocalBridge);localThread.IsBackground=true;localThread.Start();
    }
    void LocalBridge() {
      string origin=Data.Endpoint(worker.Config).GetLeftPart(UriPartial.Authority);
      try {
        using(var listener=new HttpListener()) {
          listener.Prefixes.Add("http://127.0.0.1:17645/");listener.TimeoutManager.EntityBody=TimeSpan.FromSeconds(3);listener.TimeoutManager.HeaderWait=TimeSpan.FromSeconds(3);listener.Start();
          while(!stop.WaitOne(0)) {
            var waiting=listener.BeginGetContext(null,null);
            if(WaitHandle.WaitAny(new[]{waiting.AsyncWaitHandle,stop})!=0)break;
            var context=listener.EndGetContext(waiting);var request=context.Request;var response=context.Response;
            try {
              if(request.Headers["Origin"]!=origin || request.Url.AbsolutePath!="/pair") { response.StatusCode=403;continue; }
              response.Headers["Access-Control-Allow-Origin"]=origin;
              response.Headers["Access-Control-Allow-Methods"]="POST, OPTIONS";
              response.Headers["Access-Control-Allow-Headers"]="Content-Type";
              response.Headers["Access-Control-Allow-Private-Network"]="true";
              response.Headers["Cache-Control"]="no-store";
              if(request.HttpMethod=="OPTIONS"){response.StatusCode=204;continue;}
              if(request.HttpMethod!="POST" || request.ContentLength64<1 || request.ContentLength64>256){response.StatusCode=400;continue;}
              using(var reader=new StreamReader(request.InputStream)) {
                var input=Data.Parse(reader.ReadToEnd());string code=Data.Text(input,"code");
                if(code.Length!=8){response.StatusCode=400;continue;}
                worker.Pair(code,"loopback");
              }
              byte[] result=Encoding.UTF8.GetBytes("{\"paired\":true}");response.ContentType="application/json";response.ContentLength64=result.Length;response.OutputStream.Write(result,0,result.Length);
            } catch { response.StatusCode=503; } finally { response.Close(); }
          }
        }
      } catch { /* A blocked/occupied local listener never grants site access. */ }
    }
    void Pipes() {
      while(!stop.WaitOne(0)) {
        try {
          var acl=new PipeSecurity(); acl.AddAccessRule(new PipeAccessRule(new SecurityIdentifier(WellKnownSidType.BuiltinUsersSid,null),PipeAccessRights.ReadWrite,AccessControlType.Allow)); acl.AddAccessRule(new PipeAccessRule(new SecurityIdentifier(WellKnownSidType.LocalSystemSid,null),PipeAccessRights.FullControl,AccessControlType.Allow));
          using(var pipe=new NamedPipeServerStream("AegisDLP",PipeDirection.InOut,1,PipeTransmissionMode.Byte,PipeOptions.Asynchronous,4096,4096,acl)) {
            var wait=pipe.BeginWaitForConnection(null,null);
            if(WaitHandle.WaitAny(new[]{wait.AsyncWaitHandle,stop})!=0)break;
            pipe.EndWaitForConnection(wait);
            var reader=new StreamReader(pipe,Encoding.UTF8,false,4096,true);var writer=new StreamWriter(pipe,new UTF8Encoding(false),4096,true){AutoFlush=true};
            var reading=reader.ReadLineAsync(); if(!reading.Wait(10000))continue;
            string line=reading.Result; if(line==null || line.Length>2000)continue;
            var input=Data.Parse(line); bool ok=false;
            try {
              if(Data.Text(input,"action")=="unlock")ok=worker.Unlock(Data.Text(input,"password"));
              if(Data.Text(input,"action")=="pair") { worker.Pair(Data.Text(input,"code"));ok=true; }
            } catch {}
            writer.WriteLine(Data.Json(new { ok=ok }));
          }
        } catch { stop.WaitOne(1000); }
      }
    }
    protected override void OnStop() { stop.Set(); RequestAdditionalTime(30000); if(thread!=null)thread.Join(25000); }
  }

  // Регистрация службы при установке. Пользовательский трей и фоновая служба запускаются отдельно.
  [RunInstaller(true)] public sealed class ServiceRegistration : Installer {
    public ServiceRegistration() {
      Installers.Add(new ServiceProcessInstaller { Account=ServiceAccount.LocalSystem });
      Installers.Add(new ServiceInstaller { ServiceName="AegisDLP",DisplayName="Aegis DLP",Description="Aegis DLP: автономная защита и управляемые политики Windows",StartType=ServiceStartMode.Automatic });
    }
  }

  // Небольшой диалог ввода кода или пароля для локальных действий пользователя.
  sealed class Prompt : Form {
    public string Value { get { return input.Text; } } readonly TextBox input=new TextBox();
    public Prompt(string title,string caption,bool password) {
      Text=title;Size=new Size(470,190);StartPosition=FormStartPosition.CenterScreen;FormBorderStyle=FormBorderStyle.FixedDialog;MaximizeBox=false;MinimizeBox=false;
      var label=new Label { Text=caption,Left=20,Top=18,Width=420,Height=42 };input.Left=20;input.Top=65;input.Width=410;input.UseSystemPasswordChar=password;
      var button=new Button { Text="Продолжить",Left=290,Top=102,Width=140,DialogResult=DialogResult.OK };Controls.AddRange(new Control[]{label,input,button});AcceptButton=button;
    }
  }

  // Значок в области уведомлений и команды пользователя; основная защита работает в службе.
  sealed class Tray : ApplicationContext {
    readonly NotifyIcon icon; readonly System.Windows.Forms.Timer timer;
    public Tray() {
      var menu=new ContextMenuStrip(); menu.Items.Add("Открыть Aegis DLP",null,delegate { Open(); });menu.Items.Add("Закрыть значок (служба продолжит работу)",null,delegate { icon.Visible=false;Application.ExitThread(); });
      icon=new NotifyIcon { Icon=SystemIcons.Shield,Text="Aegis DLP",ContextMenuStrip=menu,Visible=true }; icon.DoubleClick+=delegate { Open(); };
      timer=new System.Windows.Forms.Timer { Interval=5000 };timer.Tick+=delegate { Refresh(); };timer.Start();Refresh();
    }
    void Refresh() {
      try { var status=Data.Read(Path.Combine(Data.Root,"status.json"),false); DateTime seen=DateTime.Parse(Data.Text(status,"time")).ToUniversalTime(); bool fresh=DateTime.UtcNow.Subtract(seen).TotalSeconds<100; icon.Text=!fresh ? "Aegis DLP · служба не отвечает" : Convert.ToBoolean(status["connected"]) ? "Aegis DLP · на связи" : "Aegis DLP · автономный режим";icon.Icon=fresh && Data.Text(status,"policy_error")=="" && Data.Text(status,"error")=="" ? SystemIcons.Shield : SystemIcons.Warning; }
      catch { icon.Text="Aegis DLP · ожидаем состояние службы";icon.Icon=SystemIcons.Warning; }
    }
    static bool Send(object value) {
      using(var pipe=new NamedPipeClientStream(".","AegisDLP",PipeDirection.InOut,PipeOptions.Asynchronous)) {
        pipe.Connect(3000);var writer=new StreamWriter(pipe,new UTF8Encoding(false),4096,true){AutoFlush=true};var reader=new StreamReader(pipe,Encoding.UTF8,false,4096,true);writer.WriteLine(Data.Json(value));var read=reader.ReadLineAsync();if(!read.Wait(10000))return false;return Convert.ToBoolean(Data.Parse(read.Result)["ok"]);
      }
    }
    void Open() {
      using(var prompt=new Prompt("Aegis DLP","Введите локальный пароль Aegis DLP",true)) {
        if(prompt.ShowDialog()!=DialogResult.OK)return;
        try { if(!Send(new{action="unlock",password=prompt.Value})) { MessageBox.Show("Неверный пароль или попытки временно заблокированы.","Aegis DLP");return; }
          var status=Data.Read(Path.Combine(Data.Root,"status.json"),false);
          MessageBox.Show("Aegis DLP работает как служба Windows.\nПолитика: "+Data.Number(status,"policy_version")+"\nПодробная статистика и управление доступны в разделе Aegis DLP на сайте.","Aegis DLP");
          Uri panel; if(Uri.TryCreate(Data.Text(status,"panel_url"),UriKind.Absolute,out panel) && (panel.Scheme=="https" || (panel.Scheme=="http" && panel.IsLoopback)))Process.Start(new ProcessStartInfo(panel.AbsoluteUri){UseShellExecute=true});
        } catch { MessageBox.Show("Служба недоступна. Обратитесь к администратору.","Aegis DLP"); }
      }
    }
    void Pair() {
      using(var prompt=new Prompt("Aegis DLP","Введите 8-значный код из раздела Aegis DLP на сайте",false)) {
        if(prompt.ShowDialog()!=DialogResult.OK)return;
        try { MessageBox.Show(Send(new {action="pair",code=prompt.Value}) ? "Сеанс подключён. Вернитесь на сайт." : "Код не принят. Получите новый код на сайте.","Aegis DLP"); }catch { MessageBox.Show("Служба недоступна.","Aegis DLP"); }
      }
    }
  }

  // Разбирает режим запуска EXE и выбирает установку, служебный запуск или пользовательский интерфейс.
  static class Program {
    static void Sc(string arguments) {
      using(var process=Process.Start(new ProcessStartInfo(Path.Combine(Environment.GetFolderPath(Environment.SpecialFolder.System),"sc.exe"),arguments){UseShellExecute=false,CreateNoWindow=true,RedirectStandardOutput=true,RedirectStandardError=true})) { process.StandardOutput.ReadToEnd();process.StandardError.ReadToEnd();process.WaitForExit();if(process.ExitCode!=0)throw new IOException("Service configuration failed"); }
    }
    static void Elevated(string action) {
      Process.Start(new ProcessStartInfo(Assembly.GetExecutingAssembly().Location,action){UseShellExecute=true,Verb="runas"});
    }
    static void Install() {
      if(!Data.Admin){Elevated("--install");return;}
      string source=Assembly.GetExecutingAssembly().Location;
      var config=Data.Read(Path.Combine(Path.GetDirectoryName(source),"enrollment.json"),false);Data.Endpoint(config);
      if(Data.Text(config,"token").Length<40)throw new InvalidDataException("Invalid enrollment key");
      if(ServiceController.GetServices().Any(s=>s.ServiceName=="AegisDLP"))throw new InvalidOperationException("Aegis DLP уже установлен. Обновление выполняет администратор.");
      string password;
      using(var first=new Prompt("Установка Aegis DLP","Задайте локальный пароль (не менее 12 символов)",true)) {
        if(first.ShowDialog()!=DialogResult.OK)return;password=first.Value;
      }
      using(var second=new Prompt("Установка Aegis DLP","Повторите локальный пароль",true)) {
        if(second.ShowDialog()!=DialogResult.OK)return;if(password.Length<12 || password!=second.Value)throw new InvalidDataException("Пароли не совпадают или слишком короткие");
      }
      byte[] salt=new byte[24];using(var rng=RandomNumberGenerator.Create())rng.GetBytes(salt);
      config["password_salt"]=Convert.ToBase64String(salt);config["password_hash"]=Data.PasswordHash(password,salt);config["installation_id"]=Guid.NewGuid().ToString();
      Data.Acl(Data.Root,true);Data.Acl(Data.Private,false);Data.Acl(Data.Bin,true);
      string target=Path.Combine(Data.Bin,"AegisDLP.exe");File.Copy(source,target,true);Data.Write(Path.Combine(Data.Private,"config.dat"),config,true);
      ManagedInstallerClass.InstallHelper(new[]{target});
      Sc("sdset AegisDLP D:(A;;CCDCLCSWRPWPDTLOCRSDRCWDWO;;;SY)(A;;CCDCLCSWRPWPDTLOCRSDRCWDWO;;;BA)(A;;CCLCSWLO;;;BU)");
      Sc("failure AegisDLP reset= 86400 actions= restart/5000/restart/15000/restart/60000");
      using(var key=Registry.LocalMachine.CreateSubKey(@"SOFTWARE\Microsoft\Windows\CurrentVersion\Run")) key.SetValue("AegisDLP","\""+target+"\" --tray");
      using(var key=Registry.LocalMachine.CreateSubKey(@"SOFTWARE\Microsoft\Windows\CurrentVersion\Uninstall\AegisDLP")) {
        key.SetValue("DisplayName","Aegis DLP");key.SetValue("DisplayVersion","2.0.0");key.SetValue("Publisher","AegisBorder");key.SetValue("UninstallString","\""+target+"\" --uninstall");key.SetValue("NoModify",1);key.SetValue("NoRepair",1);
      }
      using(var controller=new ServiceController("AegisDLP")){controller.Start();controller.WaitForStatus(ServiceControllerStatus.Running,TimeSpan.FromSeconds(30));}
      Process.Start(new ProcessStartInfo(target,"--tray"){UseShellExecute=true});
      MessageBox.Show("Aegis DLP установлен. Служба запускается вместе с Windows, значок появится в трее при входе пользователей.\n\nАрхив содержит ключ активации: удалите его или храните в защищённом месте. Политики задаёт руководитель в панели Aegis DLP.","Aegis DLP");
    }
    static void Uninstall() {
      if(!Data.Admin){Elevated("--uninstall");return;}
      var worker=new Worker(false,false);using(var prompt=new Prompt("Удаление Aegis DLP","Введите локальный пароль. Требуются права администратора Windows.",true)) {
        if(prompt.ShowDialog()!=DialogResult.OK)return;if(!worker.Unlock(prompt.Value))throw new UnauthorizedAccessException("Неверный пароль или вход временно заблокирован");
      }
      using(var controller=new ServiceController("AegisDLP")){if(controller.Status!=ServiceControllerStatus.Stopped){controller.Stop();controller.WaitForStatus(ServiceControllerStatus.Stopped,TimeSpan.FromSeconds(45));}}
      UsbPolicy.Apply("restore");ManagedInstallerClass.InstallHelper(new[]{"/u",Path.Combine(Data.Bin,"AegisDLP.exe")});
      using(var key=Registry.LocalMachine.OpenSubKey(@"SOFTWARE\Microsoft\Windows\CurrentVersion\Run",true))if(key!=null)key.DeleteValue("AegisDLP",false);
      Registry.LocalMachine.DeleteSubKeyTree(@"SOFTWARE\Microsoft\Windows\CurrentVersion\Uninstall\AegisDLP",false);
      MessageBox.Show("Служба Aegis DLP удалена, прежняя USB-политика восстановлена. Файлы журнала оставлены администратору. Доступ к сайту будет закрыт после истечения времени связи.","Aegis DLP");
    }
    [STAThread] static void Main(string[] args) {
      try {
        if(args.Length>0 && args[0]=="--service"){ServiceBase.Run(new AgentService());return;}
        // SCM launches the executable without arguments by ServiceInstaller design.
        if(!Environment.UserInteractive){ServiceBase.Run(new AgentService());return;}
        if(args.Length>0 && args[0]=="--self-test") {
          byte[] test=Encoding.UTF8.GetBytes("Aegis native self-test");if(!Data.Secret(Data.Secret(test,false),true).SequenceEqual(test))throw new Exception("DPAPI round trip failed");
          byte[] salt=new byte[24];if(!Data.Equal(Data.PasswordHash("test-only-password",salt),Data.PasswordHash("test-only-password",salt)) || Data.Equal("different","value"))throw new Exception("Password verification failed");
          Console.WriteLine("Aegis DLP native crypto self-test passed; no service or policy installed");return;
        }
        if(args.Length==2 && args[0]=="--collect-once"){File.WriteAllText(args[1],Data.Json(Data.Collect()),Encoding.UTF8);return;}
        if(args.Length==2 && args[0]=="--test-cycle") {
          var test=Data.Read(args[1],false);Data.Root=Data.Text(test,"root");
          if(!Data.Endpoint(test["config"] as Dictionary<string,object>).IsLoopback)throw new InvalidDataException("Test mode only accepts loopback servers");
          string marker=Path.Combine(Data.Root,".native-test");
          if(Directory.Exists(Data.Root) && !File.Exists(marker))throw new IOException("Test directory must be new or previously marked for native tests");
          Directory.CreateDirectory(Data.Private);Data.Write(Path.Combine(Data.Private,"config.dat"),test["config"],true);
          File.WriteAllText(marker,"Native test only; not a service",Encoding.UTF8);
          var worker=new Worker(false,false);worker.Cycle(test["snapshot"] as Dictionary<string,object>);
          if(!worker.Connected || worker.PolicyVersion<1 || worker.PolicyError!=null)throw new IOException("Native test cycle failed");
          Console.WriteLine("Native queue/HTTPS/policy test passed; not running as a service and cannot unlock the site");return;
        }
        if(args.Length==2 && args[0]=="--test-bridge") {
          var test=Data.Read(args[1],false);Data.Root=Data.Text(test,"root");
          if(!Data.Endpoint(test["config"] as Dictionary<string,object>).IsLoopback)throw new InvalidDataException("Test mode only accepts loopback servers");
          if(Directory.Exists(Data.Root))throw new IOException("Bridge test directory must be new");
          Directory.CreateDirectory(Data.Private);Data.Write(Path.Combine(Data.Private,"config.dat"),test["config"],true);
          new AgentService().TestBridge(new Worker(false,false));return;
        }
        Application.EnableVisualStyles();Application.SetCompatibleTextRenderingDefault(false);
        if(args.Length>0 && args[0]=="--install"){Install();return;}
        if(args.Length>0 && args[0]=="--uninstall"){Uninstall();return;}
        if(args.Length>0 && args[0]=="--tray"){Application.Run(new Tray());return;}
        if(File.Exists(Path.Combine(Path.GetDirectoryName(Assembly.GetExecutingAssembly().Location),"enrollment.json")))Install();else Application.Run(new Tray());
      } catch(Exception ex) { if(args.Length>0 && (args[0]=="--self-test" || args[0]=="--collect-once" || args[0]=="--test-cycle" || args[0]=="--test-bridge")){Console.Error.WriteLine(ex.GetType().Name);Environment.Exit(1);}else MessageBox.Show(ex.Message,"Aegis DLP",MessageBoxButtons.OK,MessageBoxIcon.Error); }
    }
  }
}
