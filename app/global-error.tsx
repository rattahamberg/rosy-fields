"use client";

// Catches errors thrown during root layout rendering. Must include its own
// <html> and <body> because the root layout did not run.
export default function GlobalError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  return (
    <html lang="en">
      <body>
        <div
          style={{
            display: "flex",
            minHeight: "100vh",
            alignItems: "center",
            justifyContent: "center",
            fontFamily: "system-ui, sans-serif",
          }}
        >
          <div style={{ textAlign: "center", maxWidth: 480, padding: 24 }}>
            <h1 style={{ fontSize: 24, fontWeight: 600 }}>
              Something went wrong
            </h1>
            <p style={{ marginTop: 12, color: "#52525b" }}>
              The app crashed at a low level.
              {error.digest ? (
                <>
                  {" "}
                  Reference: <code>{error.digest}</code>
                </>
              ) : null}
            </p>
            <button
              type="button"
              onClick={reset}
              style={{
                marginTop: 16,
                padding: "8px 12px",
                borderRadius: 6,
                background: "#18181b",
                color: "white",
                border: "none",
                cursor: "pointer",
              }}
            >
              Try again
            </button>
          </div>
        </div>
      </body>
    </html>
  );
}
