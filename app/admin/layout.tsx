import "../globals.css";
import "../github-markdown.css";

const defaultUrl = process.env.VERCEL_URL
  ? `https://${process.env.VERCEL_URL}`
  : "http://localhost:3000";

export const metadata = {
  metadataBase: new URL(defaultUrl),
  title: "IC CBT System",
  description: "Laman ujian daring IC CBT System",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <div className="bg-background text-foreground">
      <div className="flex-1 w-full flex flex-col items-center">
        <div className="flex flex-col gap-20 w-full">{children}</div>
      </div>
    </div>
  );
}
