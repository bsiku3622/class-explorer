import React from "react";

interface RetroFeatureTagProps {
    children: React.ReactNode;
}

const RetroFeatureTag: React.FC<RetroFeatureTagProps> = ({ children }) => (
    <div className="absolute top-0 right-0 px-6 py-1.5 bg-black text-white text-xs font-black tracking-widest uppercase">
        {children}
    </div>
);

export default RetroFeatureTag;
