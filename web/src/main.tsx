import React from "react";
import ReactDOM from "react-dom/client";
import QRCode from "qrcode";

function compactTypeCode(authType: "WPA" | "WEP" | "nopass") {
  if (authType === "nopass") return "N";
  if (authType === "WEP") return "E";
  return "W";
}

function buildWifiQrPayload(ssid: string, password: string, authType: "WPA" | "WEP" | "nopass") {
  const compactSsid = ssid.trim();
  const compactPassword = authType === "nopass" ? "" : password;
  return `K1:${compactTypeCode(authType)}:${compactSsid.length}:${compactSsid}${compactPassword}`;
}

function App() {
  const [ssid, setSsid] = React.useState("");
  const [password, setPassword] = React.useState("");
  const [authType, setAuthType] = React.useState<"WPA" | "WEP" | "nopass">("WPA");
  const [qrUrl, setQrUrl] = React.useState("");

  const payload = React.useMemo(
    () => buildWifiQrPayload(ssid, password, authType),
    [ssid, password, authType],
  );

  React.useEffect(() => {
    let cancelled = false;

    async function renderQr() {
      if (!ssid.trim()) {
        setQrUrl("");
        return;
      }

      const url = await QRCode.toDataURL(payload, {
        errorCorrectionLevel: "M",
        margin: 3,
        width: 320,
        color: { dark: "#111111", light: "#ffffff" },
      });

      if (!cancelled) setQrUrl(url);
    }

    renderQr().catch(() => {
      if (!cancelled) setQrUrl("");
    });

    return () => {
      cancelled = true;
    };
  }, [payload, ssid]);

  const hasSpace = /\s/.test(ssid.trim());
  const passwordTooShort = authType === "WPA" && password.length > 0 && password.length < 8;

  return (
    <main style={styles.shell}>
      <section style={styles.panel}>
        <div>
          <p style={styles.kicker}>KineticLife Pairing</p>
          <h1 style={styles.title}>WiFi QR</h1>
          <p style={styles.copy}>
            Enter the phone hotspot SSID and password, then hold this QR code about 30 cm in front of the ESP32 camera.
          </p>
        </div>

        <label style={styles.label}>
          SSID
          <input
            style={styles.input}
            value={ssid}
            autoComplete="off"
            placeholder="Phone-hotspot-name"
            onChange={(event) => setSsid(event.target.value)}
          />
        </label>

        <label style={styles.label}>
          Security
          <select
            style={styles.input}
            value={authType}
            onChange={(event) => setAuthType(event.target.value as "WPA" | "WEP" | "nopass")}
          >
            <option value="WPA">WPA/WPA2</option>
            <option value="WEP">WEP</option>
            <option value="nopass">No password</option>
          </select>
        </label>

        {authType !== "nopass" && (
          <label style={styles.label}>
            Password
            <input
              style={styles.input}
              value={password}
              autoComplete="off"
              placeholder="Hotspot password"
              type="password"
              onChange={(event) => setPassword(event.target.value)}
            />
          </label>
        )}

        <div style={styles.notice}>
          <strong>Max compatibility:</strong> use a 2.4 GHz hotspot and avoid spaces in the SSID. Set screen brightness to 100% while pairing.
        </div>

        {hasSpace && <div style={styles.warning}>SSID contains a space. ESP32 may still connect, but hotspot QR pairing is more reliable without spaces.</div>}
        {passwordTooShort && <div style={styles.warning}>WPA passwords are usually 8 characters or longer.</div>}

        <pre style={styles.payload}>{ssid.trim() ? payload : "K1:W:<SSID_LEN>:<SSID><PASSWORD>"}</pre>
      </section>

      <section style={styles.qrPanel}>
        {qrUrl ? (
          <img src={qrUrl} alt="WiFi QR code" style={styles.qr} />
        ) : (
          <div style={styles.emptyQr}>Enter SSID</div>
        )}
      </section>
    </main>
  );
}

const styles: Record<string, React.CSSProperties> = {
  shell: {
    minHeight: "100dvh",
    display: "grid",
    gridTemplateColumns: "minmax(0, 1fr)",
    gap: 20,
    alignItems: "center",
    padding: "24px 16px",
    background: "#f5f7fb",
    color: "#172033",
    fontFamily: "Inter, ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont, Segoe UI, sans-serif",
  },
  panel: {
    width: "min(100%, 520px)",
    margin: "0 auto",
    display: "grid",
    gap: 14,
  },
  qrPanel: {
    width: "min(100%, 380px)",
    margin: "0 auto",
    display: "grid",
    placeItems: "center",
    minHeight: 360,
    background: "#ffffff",
    border: "1px solid #dde4ef",
    borderRadius: 8,
    boxShadow: "0 18px 40px rgba(33, 49, 77, 0.12)",
  },
  kicker: {
    margin: 0,
    color: "#50617c",
    fontSize: 13,
    fontWeight: 700,
    textTransform: "uppercase",
    letterSpacing: 0,
  },
  title: {
    margin: "4px 0 8px",
    fontSize: 36,
    lineHeight: 1.05,
    letterSpacing: 0,
  },
  copy: {
    margin: 0,
    color: "#50617c",
    fontSize: 16,
    lineHeight: 1.45,
  },
  label: {
    display: "grid",
    gap: 6,
    color: "#2a3953",
    fontSize: 14,
    fontWeight: 700,
  },
  input: {
    width: "100%",
    border: "1px solid #bac6d8",
    borderRadius: 6,
    padding: "12px 13px",
    font: "inherit",
    color: "#172033",
    background: "#ffffff",
  },
  notice: {
    border: "1px solid #b8d6c8",
    background: "#eef8f3",
    color: "#1f5c43",
    borderRadius: 6,
    padding: 12,
    fontSize: 14,
    lineHeight: 1.4,
  },
  warning: {
    border: "1px solid #ead292",
    background: "#fff8e4",
    color: "#76590d",
    borderRadius: 6,
    padding: 10,
    fontSize: 13,
  },
  payload: {
    margin: 0,
    whiteSpace: "pre-wrap",
    wordBreak: "break-all",
    background: "#172033",
    color: "#dbe7f6",
    borderRadius: 6,
    padding: 12,
    fontSize: 12,
  },
  qr: {
    width: "min(320px, 82vw)",
    height: "min(320px, 82vw)",
  },
  emptyQr: {
    display: "grid",
    placeItems: "center",
    width: "min(320px, 82vw)",
    height: "min(320px, 82vw)",
    border: "1px dashed #bac6d8",
    borderRadius: 6,
    color: "#697891",
    fontWeight: 700,
  },
};

ReactDOM.createRoot(document.getElementById("root") as HTMLElement).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>,
);
