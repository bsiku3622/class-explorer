import React from "react";
import { Navbar, NavbarBrand, NavbarContent } from "@heroui/react";
import { LogOut, ShieldCheck } from "lucide-react";

interface NavigationProps {
    onLogoClick: () => void;
    onLogout: () => void;
    isAdmin?: boolean;
    username?: string;
}

const Navigation: React.FC<NavigationProps> = ({ onLogoClick, onLogout, isAdmin = false, username = "" }) => {
    return (
        <Navbar
            isBordered={false}
            className="fixed top-0 left-0 right-0 bg-retro-secondary border-b border-black h-20 shadow-[0_4px_0_0_rgba(0,0,0,0.2)] z-1000"
            maxWidth="full"
        >
            <NavbarBrand>
                <button
                    onClick={onLogoClick}
                    className="text-2xl font-black tracking-tighter text-white uppercase transform -skew-x-6 hover:scale-105 transition-transform active:scale-95"
                >
                    Class Explorer
                </button>
            </NavbarBrand>
            <NavbarContent justify="end" className="gap-6">
                {username && (
                    <span className="hidden sm:flex items-center gap-1.5 text-white/50 text-[11px] font-black uppercase tracking-widest">
                        {isAdmin && <ShieldCheck size={12} className="text-white/60" />}
                        {username}
                    </span>
                )}
                <button
                    onClick={onLogout}
                    className="flex items-center gap-2 border-2 border-white/30 hover:border-white bg-white/10 hover:bg-white/20 text-white px-3 py-1.5 transition-all duration-100"
                >
                    <LogOut size={14} strokeWidth={2.5} />
                    <span className="hidden sm:inline text-xs font-black uppercase tracking-widest">
                        Logout
                    </span>
                </button>
            </NavbarContent>
        </Navbar>
    );
};

export default Navigation;
