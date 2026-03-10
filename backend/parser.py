import json

def parse_ksain_data(raw_data: str):
    """
    KSAIN API 응답 데이터에서 '중복 없는 수강 목록'과 각 수업의 시간대(요일, 교시)를 추출
    """
    try:
        inner_json_str = json.loads(raw_data).get("data", "[]")
        timetable_list = json.loads(inner_json_str)
        
        # 수업별 데이터 매핑 (키: subject, section, teacher)
        class_map = {}
        day_names = ["MON", "TUE", "WED", "THU", "FRI"]
        
        for idx, row in enumerate(timetable_list):
            period = idx + 1 # 1-indexed period
            
            for i in range(1, 6): # value1 to value5 (MON to FRI)
                day = day_names[i-1]
                val = row.get(f"value{i}")
                
                if val:
                    parts = val.split("<br>")
                    if len(parts) >= 3:
                        subject = parts[0].strip()
                        section = parts[1].strip()
                        teacher = parts[2].strip()
                        room = parts[3].strip() if len(parts) > 3 else "Unknown"
                        
                        key = (subject, section, teacher)
                        if key not in class_map:
                            class_map[key] = {
                                "subject": subject,
                                "section": section,
                                "teacher": teacher,
                                "room": room,
                                "times": []
                            }
                        
                        class_map[key]["times"].append({
                            "day": day,
                            "period": period,
                            "room": room
                        })
        
        return list(class_map.values())
    except Exception as e:
        print(f"Parsing Error: {e}")
        return []
