import { NextResponse } from "next/server";

function extractJson(text: string) {
  const cleaned = text
    .replace(/```json/g, "")
    .replace(/```/g, "")
    .trim();

  const first = cleaned.indexOf("{");
  const last = cleaned.lastIndexOf("}");

  if (first === -1 || last === -1) {
    throw new Error("No JSON found");
  }

  return JSON.parse(cleaned.slice(first, last + 1));
}

export async function POST(req: Request) {
  try {
    const data = await req.json();

    const matchedText =
      data.matchedPrograms
        ?.slice(0, 15)
        .map(
          (p: any, index: number) =>
            `${index + 1}. ${p.institution || "-"} | ${p.faculty || "-"} | ${
              p.program || p.major || "-"
            } | min_score:${p.min_score ?? "-"} | max_score:${
              p.max_score ?? "-"
            } | year:${p.year ?? "-"}`
        )
        .join("\n") || "ไม่พบข้อมูลย้อนหลังที่ตรงกัน";

    const prompt = `
คุณคือ AI แนะแนว TCAS สำหรับนักเรียนไทย
ตอบกลับเป็น JSON เท่านั้น ห้ามใช้ markdown ห้ามใส่คำอธิบายนอก JSON

ข้อมูลนักเรียน:
คณะเป้าหมาย: ${data.major}
มหาวิทยาลัยเป้าหมาย: ${data.university}
GPAX: ${data.gpax}
TGAT: ${data.tgat}
TPAT/A-Level: ${data.score}
วิชาที่อ่อน: ${data.weakSubjects}
เวลาที่เหลือ: ${data.remainingDays} วัน

ข้อมูล TCAS ย้อนหลังที่ค้นเจอ:
${matchedText}

ให้วิเคราะห์โดยอิงข้อมูล TCAS ย้อนหลังด้านบน และตอบ JSON ตาม schema นี้เท่านั้น:

{
  "admissionChance": 50,
  "status": "วิเคราะห์เบื้องต้น",
  "summary": "สรุปภาพรวมสั้นๆ",
  "universityMatches": [
    {
      "type": "dream",
      "name": "ชื่อคณะ/มหาวิทยาลัย",
      "chance": 20,
      "reason": "เหตุผล",
      "minScore": 72.5,
      "maxScore": 81.2,
      "year": 2568
    },
    {
      "type": "target",
      "name": "ชื่อคณะ/มหาวิทยาลัย",
      "chance": 50,
      "reason": "เหตุผล",
      "minScore": 72.45,
      "maxScore": 81.20,
      "year": 2568
    },
    {
      "type": "safe",
      "name": "ชื่อคณะ/มหาวิทยาลัย",
      "chance": 75,
      "reason": "เหตุผล",
      "minScore": 72.45,
      "maxScore": 81.20,
      "year": 2568
    }
  ],
  "prioritySubjects": ["วิชา 1", "วิชา 2"],
  "todayPlan": ["แผนวันนี้ 1", "แผนวันนี้ 2"],
  "sevenDayPlan": ["Day 1: ...", "Day 2: ..."],
  "riskAnalysis": ["ความเสี่ยง 1", "ความเสี่ยง 2"],
  "strategicAdvice": "คำแนะนำเชิงกลยุทธ์",
  "nextAction": "สิ่งที่ควรทำทันที"
}
`;

    const response = await fetch(
      "https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent",
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "x-goog-api-key": process.env.GEMINI_API_KEY || "",
        },
        body: JSON.stringify({
          contents: [
            {
              parts: [{ text: prompt }],
            },
          ],
          generationConfig: {
            temperature: 0.4,
            responseMimeType: "application/json",
          },
        }),
      }
    );

    const result = await response.json();

    const raw =
      result?.candidates?.[0]?.content?.parts?.[0]?.text ||
      result?.error?.message ||
      "";

    console.log("Gemini raw:", raw);

    let parsed;

    try {
      parsed = extractJson(raw);
    } catch {
      parsed = {
        admissionChance: 50,
        status: "วิเคราะห์เบื้องต้น",
        summary:
          raw ||
          "AI ตอบกลับไม่เป็น JSON แต่ระบบยังรับข้อมูลได้ กรุณากดวิเคราะห์ใหม่",
        universityMatches: [
          {
            type: "dream",
            name: data.university
              ? `${data.major} ${data.university}`
              : `${data.major} มหาวิทยาลัยชั้นนำ`,
            chance: 20,
            reason: "ยังต้องเพิ่มคะแนนหลักให้สูงขึ้นจากข้อมูลย้อนหลัง",
          },
          {
            type: "target",
            name: `${data.major} มหาวิทยาลัยกลุ่มเป้าหมาย`,
            chance: 50,
            reason: "มีโอกาสปานกลางหากยกระดับคะแนนสอบ",
          },
          {
            type: "safe",
            name: "สาขาใกล้เคียงหรือมหาวิทยาลัยทางเลือก",
            chance: 75,
            reason: "เหมาะสำหรับใช้เป็นแผนสำรอง",
          },
        ],
        prioritySubjects: [data.weakSubjects || "TGAT", "A-Level"],
        todayPlan: [
          "ทบทวนวิชาที่อ่อน 90 นาที",
          "ทำโจทย์จับเวลา 60 นาที",
          "สรุปข้อผิดพลาด 30 นาที",
        ],
        sevenDayPlan: [
          "Day 1: ประเมินจุดอ่อน",
          "Day 2: ทบทวนพื้นฐาน",
          "Day 3: ทำโจทย์ชุดที่ 1",
          "Day 4: วิเคราะห์ข้อผิดพลาด",
          "Day 5: ทำ mock test",
          "Day 6: เก็บบทที่ยังอ่อน",
          "Day 7: สรุปและวางแผนรอบถัดไป",
        ],
        riskAnalysis: [
          "คะแนนปัจจุบันอาจยังห่างจากกลุ่มแข่งขันสูง",
          "ต้องจัดเวลาอ่านให้สม่ำเสมอ",
        ],
        strategicAdvice:
          "ให้ใช้ข้อมูลย้อนหลังเป็นฐาน แล้วเพิ่มคะแนนในวิชาหลักอย่างต่อเนื่อง",
        nextAction: "ทำ mock test 1 ชุดและบันทึกคะแนน",
      };
    }

    return NextResponse.json(parsed);
  } catch (error) {
    console.error("API error:", error);

    return NextResponse.json(
      {
        admissionChance: 0,
        status: "API Error",
        summary: "เกิดข้อผิดพลาดที่ API route",
        universityMatches: [],
        prioritySubjects: [],
        todayPlan: [],
        sevenDayPlan: [],
        riskAnalysis: [],
        strategicAdvice: "ตรวจสอบ GEMINI_API_KEY และ route.ts",
        nextAction: "Restart server แล้วลองใหม่",
      },
      { status: 500 }
    );
  }
}