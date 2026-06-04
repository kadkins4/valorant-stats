import "./globals.css";
import { Analytics } from "@vercel/analytics/next";

export const metadata = { title: "Vantage" };

const PORTFOLIO_URL = "https://kendalladkins.dev/?utm_source=valorant";

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en">
      <body>
        {children}
        <footer
          style={{
            textAlign: "center",
            padding: "24px 16px",
            fontSize: "13px",
            opacity: 0.6,
          }}
        >
          <a
            href={PORTFOLIO_URL}
            target="_blank"
            rel="noopener noreferrer"
            style={{ color: "inherit", textDecoration: "none" }}
          >
            ← Built by Kendall Adkins
          </a>
        </footer>
        <Analytics />
      </body>
    </html>
  );
}
