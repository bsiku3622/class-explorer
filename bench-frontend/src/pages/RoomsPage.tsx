import React, { useState, useMemo } from "react";
import { Calendar, MapPin, RefreshCcw, Search } from "lucide-react";
import type { SubjectData } from "../types";
import { DAYS_ORDER, PERIODS } from "../lib/utils";
import RetroButton from "../components/atoms/RetroButton";
import RetroSubTitle from "../components/atoms/RetroSubTitle";
import PageHeader from "../components/molecules/PageHeader";

interface RoomsPageProps {
    allClassesData: SubjectData[];
    onRoomSearch?: (room: string) => void;
}

// 형설관 교실 데이터 정의 (오른쪽에서 왼쪽 순서 반영)
const HYUNGSEOL_ROOMS: Record<number, string[]> = {
    31: ["형3101", "형3102", "형3103", "형3104", "형3105", "형3106", "형3107"],
    32: ["형3201", "형3202", "형3203", "형3204", "형3205", "형3206", "형3207"],
    33: ["형3301", "형3302", "형3303", "형3304", "형3305", "형3306", "형3307"],
    34: ["형3401", "형3402", "형3403", "형3404", "형3405", "형3406", "형3407"],
};

const ROOM_LABELS: Record<string, string> = {
    "형3101": "학부사무실", "형3102": "인문예술학부협의회실", "형3103": "교원연구실", "형3104": "교원연구실", "형3105": "교원연구실", "형3106": "보건실", "형3107": "심리상담실",
    "형3201": "허브실", "형3202": "교실", "형3203": "교실", "형3204": "교실", "형3205": "교실", "형3206": "교실", "형3207": "교실",
    "형3301": "교원연구실", "형3302": "교실", "형3303": "교실", "형3304": "교실", "형3305": "교실", "형3306": "교실", "형3307": "교실",
    "형3401": "교원연구실", "형3402": "교실", "형3403": "교실", "형3404": "교실", "형3405": "교실", "형3406": "교실", "형3407": "교실",
};

const DAYS = DAYS_ORDER;

const RoomsPage: React.FC<RoomsPageProps> = ({ allClassesData, onRoomSearch }) => {
    const [selectedTimes, setSelectedTimes] = useState<string[]>([]); // Format: "DAY-PERIOD"
    const [selectedRoom, setSelectedRoom] = useState<string | null>(null);

    // 전체 강의실 점유 데이터 맵핑
    const roomScheduleMap = useMemo(() => {
        const map: Record<string, Set<string>> = {}; 
        if (!allClassesData || allClassesData.length === 0) return map;

        allClassesData.forEach((subject) => {
            subject.sections.forEach((section) => {
                const baseRoom = section.room?.trim();
                const sectionTimes = section.times || [];
                
                sectionTimes.forEach((time) => {
                    const roomName = (time.room || baseRoom)?.trim();
                    if (!roomName) return;
                    
                    const roomNumberMatch = roomName.match(/\d+(-\d+)?/);
                    if (!roomNumberMatch) return;
                    
                    const roomNum = roomNumberMatch[0];
                    const day = (time.day || "").toUpperCase().trim();
                    const timeKey = `${day}-${time.period}`;

                    if (!map[roomNum]) map[roomNum] = new Set();
                    map[roomNum].add(timeKey);

                    const hyungRoomNum = `형${roomNum}`;
                    if (!map[hyungRoomNum]) map[hyungRoomNum] = new Set();
                    map[hyungRoomNum].add(timeKey);

                    if (!map[roomName]) map[roomName] = new Set();
                    map[roomName].add(timeKey);
                });
            });
        });
        return map;
    }, [allClassesData]);

    const toggleTime = (day: string, period: number) => {
        if (selectedRoom) return; 
        const key = `${day}-${period}`;
        setSelectedTimes((prev) =>
            prev.includes(key) ? prev.filter((t) => t !== key) : [...prev, key]
        );
    };

    const isRoomEmpty = (room: string, times: string[]) => {
        if (times.length === 0) return true;
        const schedule = roomScheduleMap[room];
        if (!schedule) return true;
        return times.every((t) => !schedule.has(t));
    };

    const handleRoomClick = (room: string) => {
        if (selectedTimes.length > 0) return; 
        setSelectedRoom(selectedRoom === room ? null : room);
    };

    const resetSelection = () => {
        setSelectedTimes([]);
        setSelectedRoom(null);
    };

    return (
        <div className="flex flex-col gap-4 md:gap-6 pb-20">
            <PageHeader
                title="Rooms"
                subtitle="형설관"
                icon={MapPin}
                action={
                    <RetroButton onClick={resetSelection} icon={<RefreshCcw size={18} strokeWidth={2.5} />}>
                        Reset Selection
                    </RetroButton>
                }
            />

            <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">
                {/* Left: Timetable */}
                <div className="lg:col-span-5 space-y-4">
                    <div className="flex items-center justify-between">
                        <RetroSubTitle
                            title={selectedRoom ? `Schedule: ${selectedRoom}` : "Select Time Slots"}
                            icon={Calendar}
                        />
                        {selectedRoom && onRoomSearch && (
                            <RetroButton
                                onClick={() => onRoomSearch(selectedRoom)}
                                icon={<Search size={14} strokeWidth={2.5} />}
                                size="sm"
                            >
                                Search
                            </RetroButton>
                        )}
                    </div>
                    <div className="overflow-x-auto">
                    <div className="bg-white border-2 border-black overflow-hidden shadow-[4px_4px_0_0_rgba(0,0,0,0.1)] min-w-[280px]">
                        <div className="grid grid-cols-[40px_repeat(5,1fr)] divide-x divide-black/10 border-b border-black bg-black text-white">
                            <div className="p-2 text-[10px] font-black text-center">Pd</div>
                            {DAYS.map(day => (
                                <div key={day} className="p-2 text-[10px] font-black text-center">{day}</div>
                            ))}
                        </div>
                        {PERIODS.map(period => (
                            <div key={period} className="grid grid-cols-[40px_repeat(5,1fr)] divide-x divide-black/10 border-b last:border-b-0 border-black/10">
                                <div className="bg-black/5 flex items-center justify-center text-[10px] font-black border-r border-black/10">{period}</div>
                                {DAYS.map(day => {
                                    const key = `${day}-${period}`;
                                    const isSelected = selectedTimes.includes(key);
                                    
                                    if (selectedRoom) {
                                        const isOccupied = roomScheduleMap[selectedRoom]?.has(key);
                                        return (
                                            <div key={day} className={`h-10 transition-all duration-75 relative ${isOccupied ? "bg-black/[0.07] grayscale" : "bg-retro-green/20"}`} />
                                        );
                                    }

                                    return (
                                        <div
                                            key={day}
                                            onClick={() => toggleTime(day, period)}
                                            className={`h-10 cursor-pointer transition-all duration-75 relative group ${isSelected ? "bg-black" : "hover:bg-retro-accent-light"}`}
                                        />
                                    );
                                })}
                            </div>
                        ))}
                    </div>
                    </div>
                    <p className="text-[10px] font-bold text-black/30">
                        {selectedRoom 
                            ? `* ${selectedRoom} 강의실의 주간 시간표입니다. (다른 강의실을 보려면 지도를 확인하세요)`
                            : "* 시간표를 클릭하여 빈교실 확인 / 지도의 교실을 클릭하여 상세 시간표 확인"}
                    </p>
                </div>

                {/* Right: Map */}
                <div className="lg:col-span-7 space-y-4">
                    <RetroSubTitle title="Hyung-seol Hall Floor Map" icon={MapPin} />
                    <div className="space-y-6">
                        {Object.keys(HYUNGSEOL_ROOMS).reverse().map((floorStr) => {
                            const floor = parseInt(floorStr);
                            const rooms = HYUNGSEOL_ROOMS[floor];
                            return (
                                <div key={floor} className="space-y-2">
                                    <div className="relative border-b-2 border-black/5 pb-2">
                                        <div className="flex flex-row-reverse flex-wrap gap-2 pb-2">
                                            {rooms.map((room) => {
                                                const isClassroom = ROOM_LABELS[room] === "교실";
                                                const isEmpty = isClassroom && isRoomEmpty(room, selectedTimes);
                                                const isSelected = selectedRoom === room;
                                                const isTimeSelecting = selectedTimes.length > 0;
                                                const shouldShowAsAvailable = selectedRoom ? isSelected : isClassroom && (isEmpty || selectedTimes.length === 0);

                                                return (
                                                    <button
                                                        key={room}
                                                        disabled={isTimeSelecting || !isClassroom}
                                                        onClick={() => isClassroom && handleRoomClick(room)}
                                                        className={`min-w-[72px] sm:min-w-[85px] h-14 sm:h-16 border-2 p-1.5 sm:p-2 flex flex-col items-center justify-center transition-all duration-100 group relative ${
                                                            isSelected
                                                                ? "bg-black text-white border-black scale-105 z-10 shadow-[4px_4px_0_0_rgba(0,0,0,0.2)] hover:shadow-[0_0_0_0_rgba(0,0,0,0.2)] active:scale-100"
                                                                : shouldShowAsAvailable
                                                                    ? `bg-white border-black shadow-[4px_4px_0_0_rgba(0,0,0,0.2)] ${isTimeSelecting ? "cursor-default" : "hover:shadow-[0_0_0_0_rgba(0,0,0,0.2)] hover:translate-x-1 hover:translate-y-1"}`
                                                                    : "bg-black/5 border-black/10 opacity-40 grayscale pointer-events-none"
                                                        }`}
                                                    >
                                                        <span className={`text-xs font-black ${isSelected ? "text-white" : "text-black"}`}>{room}</span>
                                                        <div className={`text-[8px] font-bold truncate w-full text-center mt-0.5 leading-tight ${isSelected ? "text-white/60" : "text-black/40"}`}>
                                                            {ROOM_LABELS[room]}
                                                        </div>
                                                        {isClassroom && isEmpty && !isSelected && !selectedRoom && selectedTimes.length > 0 && (
                                                            <div className="absolute top-1 right-1 w-2.5 h-2.5 bg-retro-green border border-black rounded-full" />
                                                        )}
                                                    </button>
                                                );
                                            })}
                                        </div>
                                    </div>
                                </div>
                            );
                        })}
                    </div>
                    
                    <div className="bg-retro-bg/50 border-2 border-black p-4 space-y-2">
                        <div className="flex flex-wrap items-center gap-4">
                            <div className="flex items-center gap-1.5">
                                <div className="w-3 h-3 bg-white border border-black" />
                                <span className="text-[10px] font-black uppercase tracking-widest">Available</span>
                            </div>
                            <div className="flex items-center gap-1.5">
                                <div className="w-3 h-3 bg-black/5 border border-black/10 opacity-40" />
                                <span className="text-[10px] font-black uppercase tracking-widest">Unavailable / Non-Classroom</span>
                            </div>
                            <div className="flex items-center gap-1.5">
                                <div className="w-3 h-3 bg-black" />
                                <span className="text-[10px] font-black uppercase tracking-widest">Selected</span>
                            </div>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
};

export default RoomsPage;
