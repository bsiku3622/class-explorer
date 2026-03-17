import React from "react";
import { Search, Map, BarChart3, Library, Info, ShieldCheck } from "lucide-react";
import type { LucideIcon } from "lucide-react";

interface SidebarItemProps {
    icon: LucideIcon;
    label: string;
    isActive: boolean;
    onClick: () => void;
}

const SidebarItem: React.FC<SidebarItemProps> = ({ icon: Icon, label, isActive, onClick }) => {
    return (
        <button
            onClick={onClick}
            className={`w-full flex items-center gap-3 px-4 py-3 font-black uppercase transition-all duration-100 border-2 ${
                isActive
                    ? "bg-black text-white border-black shadow-[4px_4px_0_0_rgba(0,0,0,0.2)] hover:shadow-none hover:translate-x-1 hover:translate-y-1"
                    : "text-black/60 border-transparent hover:text-black hover:bg-white/50"
            }`}
        >
            <Icon size={20} strokeWidth={2.5} />
            <span className="tracking-tight text-sm">{label}</span>
        </button>
    );
};

interface SidebarProps {
    activePage: string;
    setActivePage: (page: string) => void;
    isAdmin?: boolean;
}

const Sidebar: React.FC<SidebarProps> = ({ activePage, setActivePage, isAdmin = false }) => {
    const menuItems = [
        { id: "home", label: "Search", icon: Search },
        { id: "emptyroomfinder", label: "Rooms", icon: Map },
        { id: "analysis", label: "Analysis", icon: BarChart3 },
        { id: "browse", label: "Browse", icon: Library },
        { id: "about", label: "About", icon: Info },
    ];

    return (
        <aside className="fixed left-0 top-20 bottom-0 w-64 bg-retro-bg border-r-2 border-black z-40 overflow-y-auto hidden md:block">
            <div className="p-6 flex flex-col h-full">
                <div className="pb-4">
                    <p className="text-[10px] font-black text-black/40 uppercase tracking-[0.2em] mb-3 px-1">
                        Main Navigation
                    </p>
                    <nav className="space-y-1">
                        {menuItems.map((item) => (
                            <SidebarItem
                                key={item.id}
                                icon={item.icon}
                                label={item.label}
                                isActive={activePage === item.id}
                                onClick={() => setActivePage(item.id)}
                            />
                        ))}
                    </nav>
                </div>
                
                {isAdmin && (
                    <div className="pt-4 mt-4 border-t-2 border-black/10">
                        <p className="text-[10px] font-black text-black/40 uppercase tracking-[0.2em] mb-2 px-1">
                            Admin
                        </p>
                        <SidebarItem
                            icon={ShieldCheck}
                            label="Admin"
                            isActive={activePage === "admin"}
                            onClick={() => setActivePage("admin")}
                        />
                    </div>
                )}
                <div className="mt-auto pt-8 border-t-2 border-black/10">
                    <div className="bg-white border-2 border-black p-4 space-y-3 shadow-[4px_4px_0_0_rgba(0,0,0,0.1)]">
                        <p className="text-[10px] font-black text-black/40 uppercase tracking-widest">System Status</p>
                        <div className="flex justify-between items-center text-[10px] font-bold">
                            <span className="flex items-center gap-2"><div className="w-2 h-2 rounded-full bg-green-500 animate-pulse" /> NETWORK</span>
                            <span className="text-green-500">ONLINE</span>
                        </div>
                        <div className="flex justify-between items-center text-[10px] font-bold">
                            <span className="flex items-center gap-2"><div className="w-2 h-2 rounded-full bg-blue-500" /> DATABASE</span>
                            <span className="text-blue-500">STABLE</span>
                        </div>
                    </div>
                </div>
            </div>
        </aside>
    );
};

export default Sidebar;
