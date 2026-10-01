import PortalHeader from "@/components/PortalHeader";

export default function CaptainLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="chess-bg min-h-screen">
      <PortalHeader label="Portal Αρχηγού" />
      {children}
    </div>
  );
}
