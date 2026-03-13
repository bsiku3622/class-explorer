import React from "react";
import {
    Navbar,
    NavbarBrand,
    NavbarContent,
} from "@heroui/react";

interface NavigationProps {
    onLogoClick: () => void;
}

const Navigation: React.FC<NavigationProps> = ({ onLogoClick }) => {
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
            <NavbarContent className="hidden sm:flex gap-4 h-12" justify="end">
                {/* Search moved to main page body */}
            </NavbarContent>
        </Navbar>
    );
};

export default Navigation;
