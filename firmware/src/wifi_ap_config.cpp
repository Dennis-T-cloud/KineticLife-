#include "wifi_ap_config.h"
#include "config.h"
#include "debug_log.h"
#include "status_led.h"
#include <WiFi.h>
#include <WebServer.h>
#include <Arduino.h>

static const char* AP_SSID = "KineticLife-Setup";
static const char* AP_PASS = "kineticlife";

// ── State machine ────────────────────────────────────────────────
enum ApState { AP_IDLE, AP_CONNECTING, AP_CONNECTED, AP_FAILED };
static ApState       s_state          = AP_IDLE;
static int           s_try_idx        = -1;
static uint32_t      s_connect_start  = 0;
static WifiCredentials s_result;

static WebServer s_server(80);

// ── Minimal config page (PROGMEM) ────────────────────────────────
static const char CONFIG_HTML[] PROGMEM = R"html(<!DOCTYPE html>
<html lang="en"><head>
<meta charset="UTF-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<title>KineticLife WiFi Setup</title>
<style>
*{box-sizing:border-box}
body{margin:0;min-height:100dvh;display:grid;place-items:center;
     background:#f5f7fb;font:16px/1.5 system-ui,sans-serif;color:#172033}
.card{width:min(380px,95vw);background:#fff;border-radius:10px;padding:28px 24px;
      box-shadow:0 8px 32px rgba(0,0,0,.10);display:grid;gap:14px}
h2{margin:0;font-size:22px}p{margin:0;color:#50617c;font-size:14px}
.net{border:1.5px solid #dde4ef;border-radius:7px;padding:12px 14px;
     cursor:pointer;display:flex;justify-content:space-between;align-items:center}
.net:hover{background:#f0f8f4;border-color:#1f6f52}
.net b{font-size:15px}.net small{color:#697891;font-size:12px}
.btn{border:0;border-radius:6px;padding:10px 14px;background:#1f6f52;
     color:#fff;font:inherit;font-weight:800;cursor:pointer;font-size:14px}
.msg{border-radius:6px;padding:10px 12px;font-size:14px}
.ok{background:#eef8f3;color:#1f5c43;border:1px solid #b8d6c8}
.err{background:#fff0f0;color:#7a1010;border:1px solid #f0a0a0}
.info{background:#f0f4ff;color:#1a2a5e;border:1px solid #b0c0e8}
</style></head><body>
<div class="card">
  <div><h2>WiFi Setup</h2><p>Select a preset network — ESP32 will connect and reboot</p></div>
  <div id="nets"><p style="color:#697891">Loading…</p></div>
  <div id="msg" class="msg info" style="display:none"></div>
</div>
<script>
const msg=document.getElementById('msg');
function show(cls,txt){msg.style.display='';msg.className='msg '+cls;msg.textContent=txt}

fetch('/config-networks').then(r=>r.json()).then(nets=>{
  document.getElementById('nets').innerHTML=nets.map((n,i)=>
    `<div class="net" onclick="tryNet(${i})">
       <div><b>${n.ssid}</b><br><small>${n.auth}</small></div>
       <button class="btn">Connect</button>
     </div>`).join('');
}).catch(()=>show('err','Could not reach ESP32 — are you on KineticLife-Setup?'));

async function tryNet(i){
  show('info','Connecting…');
  const r=await fetch('/try-config?idx='+i).then(x=>x.json()).catch(()=>null);
  if(!r||!r.ok){show('err',r?r.error:'Request failed');return}
  show('info','Connecting to "'+r.ssid+'"…');
  poll();
}

function poll(){
  fetch('/config-status').then(r=>r.json()).then(d=>{
    if(d.state==='connected'){show('ok',d.msg);return}
    if(d.state==='failed'){show('err',d.msg);return}
    show('info',d.msg);
    setTimeout(poll,1000);
  }).catch(()=>{
    show('ok','ESP32 rebooting — reconnect to your WiFi network');
  });
}
</script></body></html>)html";

// ── HTTP handlers ─────────────────────────────────────────────────
static void cors(){
    s_server.sendHeader("Access-Control-Allow-Origin","*");
    s_server.sendHeader("Access-Control-Allow-Methods","GET, POST, OPTIONS");
    s_server.sendHeader("Access-Control-Allow-Headers","*");
    s_server.sendHeader("Access-Control-Allow-Private-Network","true");
}

static void handle_options() {
    cors();
    s_server.send(204);
}

static void handle_root() {
    s_server.send_P(200, "text/html", CONFIG_HTML);
}

static void handle_networks() {
    String j = "[";
    for (int i = 0; i < kConfigNetworkCount; i++) {
        if (i) j += ",";
        j += "{\"ssid\":\""; j += kConfigNetworks[i].ssid;
        j += "\",\"auth\":\""; j += kConfigNetworks[i].auth_type;
        j += "\"}";
    }
    j += "]";
    cors(); s_server.send(200, "application/json", j);
}

static void handle_try_config() {
    if (!s_server.hasArg("idx")) {
        cors(); s_server.send(400, "application/json", "{\"ok\":false,\"error\":\"missing idx\"}");
        return;
    }
    int idx = s_server.arg("idx").toInt();
    if (idx < 0 || idx >= kConfigNetworkCount) {
        cors(); s_server.send(400, "application/json", "{\"ok\":false,\"error\":\"out of range\"}");
        return;
    }
    s_try_idx       = idx;
    s_state         = AP_CONNECTING;
    s_connect_start = millis();
    WiFi.disconnect(false);
    delay(100);
    const char* pass = (strcmp(kConfigNetworks[idx].auth_type, "nopass") == 0)
                       ? nullptr : kConfigNetworks[idx].password;
    WiFi.begin(kConfigNetworks[idx].ssid, pass);
    kl_logf("[ap_config] try idx=%d ssid=\"%s\"\n", idx, kConfigNetworks[idx].ssid);
    status_led_set(DEVICE_STATE_CONNECTING);

    String resp = "{\"ok\":true,\"ssid\":\"";
    resp += kConfigNetworks[idx].ssid; resp += "\"}";
    cors(); s_server.send(200, "application/json", resp);
}

static void handle_status() {
    String j = "{\"state\":\"";
    switch (s_state) {
        case AP_CONNECTED:
            j += "connected\",\"msg\":\"Connected to "; j += s_result.ssid;
            j += " — ESP32 rebooting\"";
            break;
        case AP_FAILED:
            j += "failed\",\"msg\":\"Could not connect to ";
            j += (s_try_idx >= 0 ? kConfigNetworks[s_try_idx].ssid : "network");
            j += " — check password or try another\"";
            break;
        case AP_CONNECTING:
            j += "connecting\",\"msg\":\"Connecting to ";
            j += (s_try_idx >= 0 ? kConfigNetworks[s_try_idx].ssid : "…");
            j += "…\"";
            break;
        default:
            j += "idle\",\"msg\":\"Idle\"";
    }
    j += "}";
    cors(); s_server.send(200, "application/json", j);
}

// ── Public API ────────────────────────────────────────────────────
void wifi_ap_config_start() {
    WiFi.mode(WIFI_AP_STA);
    WiFi.softAP(AP_SSID, AP_PASS);
    delay(200);
    kl_logf("[ap_config] started ssid=%s pass=%s ip=%s\n",
            AP_SSID, AP_PASS, WiFi.softAPIP().toString().c_str());

    s_server.on("/",               HTTP_GET, handle_root);
    s_server.on("/config-networks",HTTP_GET, handle_networks);
    s_server.on("/try-config",     HTTP_GET, handle_try_config);
    s_server.on("/config-status",  HTTP_GET, handle_status);
    s_server.on("/config-networks",HTTP_OPTIONS, handle_options);
    s_server.on("/try-config",     HTTP_OPTIONS, handle_options);
    s_server.on("/config-status",  HTTP_OPTIONS, handle_options);
    s_server.begin();
}

void wifi_ap_config_poll() {
    s_server.handleClient();

    if (s_state != AP_CONNECTING) return;

    const wl_status_t ws = WiFi.status();
    if (ws == WL_CONNECTED) {
        s_result.ssid      = kConfigNetworks[s_try_idx].ssid;
        s_result.password  = kConfigNetworks[s_try_idx].password;
        s_result.auth_type = kConfigNetworks[s_try_idx].auth_type;
        s_state = AP_CONNECTED;
        kl_logf("[ap_config] connected ssid=\"%s\" ip=%s\n",
                s_result.ssid.c_str(), WiFi.localIP().toString().c_str());
        return;
    }
    if (millis() - s_connect_start > 15000) {
        kl_logf("[ap_config] timeout ssid=\"%s\"\n", kConfigNetworks[s_try_idx].ssid);
        WiFi.disconnect(false);
        s_state = AP_FAILED;
        status_led_set(DEVICE_STATE_PAIRING);
    }
}

bool wifi_ap_config_is_connecting() { return s_state == AP_CONNECTING; }

bool wifi_ap_config_get_credentials(WifiCredentials* out) {
    if (s_state != AP_CONNECTED) return false;
    *out = s_result;
    return true;
}

void wifi_ap_config_stop() {
    s_server.stop();
    WiFi.softAPdisconnect(true);
    kl_logf("[ap_config] stopped\n");
}

const char* wifi_ap_config_ssid() { return AP_SSID; }
