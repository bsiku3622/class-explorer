import json

def parse_ksain_data(raw_data: str):
    """
    KSAIN API 응답 데이터에서 '중복 없는 수강 목록'만 추출
    """
    try:
        inner_json_str = json.loads(raw_data).get("data", "[]")
        timetable_list = json.loads(inner_json_str)
        
        # 중복 제거를 위한 set (과목, 분반, 교사, 장소)
        unique_classes = set()
        
        for row in timetable_list:
            for i in range(1, 6):
                val = row.get(f"value{i}")
                if val:
                    parts = val.split("<br>")
                    subject = parts[0].strip() if len(parts) > 0 else ""
                    section = parts[1].strip() if len(parts) > 1 else ""
                    teacher = parts[2].strip() if len(parts) > 2 else ""
                    room = parts[3].strip() if len(parts) > 3 else ""
                    
                    if subject:
                        unique_classes.add((subject, section, teacher, room))
        
        # 리스트 형태로 변환하여 반환
        return [
            {"subject": c[0], "section": c[1], "teacher": c[2], "room": c[3]}
            for c in unique_classes
        ]
    except Exception as e:
        print(f"Parsing Error: {e}")
        return []