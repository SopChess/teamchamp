import PortalHeader from "@/components/PortalHeader";

export default function AdminLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="chess-bg-admin min-h-screen">
      <PortalHeader label="Admin" />
      {children}
    </div>
  );
}
