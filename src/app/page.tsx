"use client";

import { tcasDatabase } from "@/data/tcasDatabase";
import { useState } from "react";

import {
  RadarChart,
  PolarGrid,
  PolarAngleAxis,
  PolarRadiusAxis,
  Radar,
  ResponsiveContainer,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
} from "recharts";

type UniversityMatch = {
  type: "dream" | "target" | "safe";
  name: string;
  chance: number;
  reason: string;
  minScore?: number;
  maxScore?: number;
  year?: number;
};

type AIResult = {
  admissionChance: number;
  status: string;
  summary: string;
  universityMatches: UniversityMatch[];
  prioritySubjects: string[];
  todayPlan: string[];
  sevenDayPlan: string[];
  riskAnalysis: string[];
  strategicAdvice: string;
  nextAction: string;
};

const synonymMap: Record<string, string[]> = {
  แพทย์: ["แพทย์", "แพทยศาสตร์", "หมอ", "medicine", "medical"],
  วิศวกรรมศาสตร์: ["วิศวะ", "วิศวกรรม", "วิศวกรรมศาสตร์", "engineer", "engineering"],
  ทันตแพทยศาสตร์: ["ทันตะ", "ทันตแพทย์", "หมอฟัน", "dentist", "dental"],
  เภสัชศาสตร์: ["เภสัช", "เภสัชศาสตร์", "pharmacy"],
  พยาบาลศาสตร์: ["พยาบาล", "พยาบาลศาสตร์", "nursing"],
  บัญชี: ["บัญชี", "การบัญชี", "accounting"],
  บริหารธุรกิจ: ["บริหาร", "บริหารธุรกิจ", "การจัดการ", "business", "management"],
  นิติศาสตร์: ["นิติ", "นิติศาสตร์", "กฎหมาย", "law"],
  รัฐศาสตร์: ["รัฐศาสตร์", "การเมือง", "political"],
  ครุศาสตร์: ["ครุ", "ครู", "ศึกษาศาสตร์", "education"],
  สถาปัตยกรรมศาสตร์: ["สถาปัต", "สถาปัตย์", "สถาปัตยกรรม", "architecture"],
  วิทยาการคอมพิวเตอร์: ["คอม", "คอมพิวเตอร์", "วิทยาการคอมพิวเตอร์", "computer", "cs"],
  นิเทศศาสตร์: ["นิเทศ", "สื่อสาร", "communication"],
};

function normalizeText(text: string) {
  return text
    .toLowerCase()
    .replace(/\s+/g, "")
    .replace(/[^\u0E00-\u0E7Fa-z0-9]/g, "");
}

function levenshtein(a: string, b: string) {
  const matrix = Array.from({ length: a.length + 1 }, (_, i) =>
    Array.from({ length: b.length + 1 }, (_, j) => (i === 0 ? j : j === 0 ? i : 0))
  );

  for (let i = 1; i <= a.length; i++) {
    for (let j = 1; j <= b.length; j++) {
      matrix[i][j] =
        a[i - 1] === b[j - 1]
          ? matrix[i - 1][j - 1]
          : Math.min(matrix[i - 1][j], matrix[i][j - 1], matrix[i - 1][j - 1]) + 1;
    }
  }

  return matrix[a.length][b.length];
}

function getSearchKeywords(input: string) {
  const q = normalizeText(input);
  if (!q) return [];

  for (const [canonical, aliases] of Object.entries(synonymMap)) {
    const normalizedAliases = aliases.map(normalizeText);

    if (
      normalizedAliases.some(
        (alias) =>
          q.includes(alias) ||
          alias.includes(q) ||
          levenshtein(q, alias) <= 2
      )
    ) {
      return [canonical, ...aliases];
    }
  }

  return [input, q];
}

function textIncludesKeyword(text: string | null | undefined, keywords: string[]) {
  const normalizedText = normalizeText(text || "");

  return keywords.some((kw) => {
    const normalizedKeyword = normalizeText(kw);
    return (
      normalizedText.includes(normalizedKeyword) ||
      normalizedKeyword.includes(normalizedText)
    );
  });
}

function calculateRelevance(
  item: any,
  keywords: string[],
  targetUniversity: string
) {
  let score = 0;

  if (textIncludesKeyword(item.program, keywords)) score += 40;
  if (textIncludesKeyword(item.faculty, keywords)) score += 30;
  if (textIncludesKeyword(item.major, keywords)) score += 20;
  if (textIncludesKeyword(item.curriculum_id, keywords)) score += 10;

  const targetUni = normalizeText(targetUniversity);
  const institution = normalizeText(item.institution || "");

  if (targetUni && institution.includes(targetUni)) score += 50;

  if (item.min_score !== null && item.min_score !== undefined) score += 10;
  if (item.max_score !== null && item.max_score !== undefined) score += 5;

  return score;
}

export default function Home() {
  const [major, setMajor] = useState("");
  const [university, setUniversity] = useState("");
  const [gpax, setGpax] = useState("");
  const [tgat, setTgat] = useState("");
  const [score, setScore] = useState("");
  const [weakSubjects, setWeakSubjects] = useState("");
  const [remainingDays, setRemainingDays] = useState("");

  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<AIResult | null>(null);

  async function generatePlan() {
    setLoading(true);
    setResult(null);

    try {
      const searchKeywords = getSearchKeywords(major);

      const latestYear = Math.max(
        ...tcasDatabase
        .map((x: any) => Number(x.year))
        .filter((x: number) => !isNaN(x))
      );
      console.log("Latest TCAS Year:", latestYear);

      const matchedPrograms = tcasDatabase

      .filter((item: any) => {
        if (searchKeywords.length === 0) return false;

        // เอาเฉพาะปีล่าสุด
        if (Number(item.year) !== latestYear) return false;
        
        return (
          textIncludesKeyword(item.program, searchKeywords) ||
          textIncludesKeyword(item.faculty, searchKeywords) ||
          textIncludesKeyword(item.major, searchKeywords) ||
          textIncludesKeyword(item.curriculum_id, searchKeywords)
        );
      })
      .sort(
        (a: any, b: any) =>
          calculateRelevance(b, searchKeywords, university) -
        calculateRelevance(a, searchKeywords, university)
      )
      .slice(0, 5);

      console.log("Search Keywords:", searchKeywords);
      console.log("Matched Programs:", matchedPrograms);

      const response = await fetch("/api/advisor", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          major,
          university,
          gpax,
          tgat,
          score,
          weakSubjects,
          remainingDays,
          matchedPrograms,
        }),
      });

      const data = await response.json();
      setResult(data);
    } catch (error) {
      console.error(error);
    }

    setLoading(false);
  }

  const radarData = [
    { subject: "TGAT", value: Number(tgat) || 0 },
    { subject: "A-Level", value: Number(score) || 0 },
    { subject: "GPAX", value: (Number(gpax) || 0) * 25 },
    { subject: "Readiness", value: result?.admissionChance || 0 },
    { subject: "Focus", value: 70 },
  ];

  const simulationData = [
    { scenario: "Current", chance: result?.admissionChance || 0 },
    {
      scenario: "+10 TGAT",
      chance: Math.min((result?.admissionChance || 0) + 15, 100),
    },
    {
      scenario: "+20 TGAT",
      chance: Math.min((result?.admissionChance || 0) + 35, 100),
    },
  ];

  return (
    <main className="min-h-screen bg-[#020617] text-white px-6 py-10">
      <div className="mx-auto max-w-7xl">
        <div className="mb-10 text-center">
          <h1 className="text-6xl font-black bg-gradient-to-r from-cyan-400 to-blue-500 bg-clip-text text-transparent">
            TCASNAV
          </h1>
          <p className="mt-3 text-slate-300 text-lg">
            AI Strategic University Navigation Platform
          </p>
        </div>

        <div className="grid grid-cols-1 gap-8 lg:grid-cols-2">
          <div className="rounded-3xl border border-cyan-900 bg-[#07122b] p-8 shadow-2xl">
            <h2 className="text-4xl font-bold mb-2">ข้อมูลนักเรียน</h2>
            <p className="mb-8 text-slate-400">
              AI จะวิเคราะห์ Dream / Target / Safe พร้อม Score Simulation
            </p>

            <div className="space-y-5">
              <Input value={major} setValue={setMajor} placeholder="คณะที่ต้องการ เช่น แพทย์ / วิศวะ / คอม / บัญชี" />
              <Input value={university} setValue={setUniversity} placeholder="มหาวิทยาลัยเป้าหมาย เช่น จุฬา" />
              <Input value={gpax} setValue={setGpax} placeholder="GPAX เช่น 3.90" />
              <Input value={tgat} setValue={setTgat} placeholder="TGAT เช่น 65" />
              <Input value={score} setValue={setScore} placeholder="TPAT/A-Level เช่น 70" />
              <Input value={weakSubjects} setValue={setWeakSubjects} placeholder="วิชาที่อ่อน เช่น ฟิสิกส์" />
              <Input value={remainingDays} setValue={setRemainingDays} placeholder="เหลือเวลากี่วัน เช่น 120" />

              <button
                onClick={generatePlan}
                disabled={loading}
                className="w-full rounded-xl bg-cyan-500 py-4 text-lg font-bold text-black shadow-lg shadow-cyan-500/30 transition-all hover:bg-cyan-400"
              >
                {loading ? "AI กำลังวิเคราะห์..." : "วิเคราะห์ AI University Matching"}
              </button>
            </div>
          </div>

          <div className="rounded-3xl border border-cyan-900 bg-[#07122b] p-8 shadow-2xl">
            <h2 className="text-4xl font-bold mb-2">AI Dashboard</h2>
            <p className="mb-8 text-slate-400">
              Score Simulation + University Matching
            </p>

            {!result && !loading && (
              <div className="flex h-[700px] items-center justify-center rounded-2xl border border-dashed border-slate-700 text-center text-slate-500">
                กดปุ่มเพื่อเริ่มวิเคราะห์
              </div>
            )}

            {loading && (
              <div className="flex h-[700px] flex-col items-center justify-center">
                <div className="mb-6 h-16 w-16 animate-spin rounded-full border-4 border-cyan-400 border-t-transparent" />
                <p className="text-xl text-cyan-300">Gemini AI กำลังวิเคราะห์...</p>
              </div>
            )}

            {result && (
              <div className="space-y-6 max-h-[900px] overflow-y-auto pr-2">
                <div className="rounded-2xl bg-slate-800 p-5">
                  <div className="mb-2 flex items-center justify-between">
                    <p className="text-slate-400">Overall Admission Chance</p>
                    <p className="font-bold text-cyan-300">{result.admissionChance}%</p>
                  </div>

                  <div className="h-4 overflow-hidden rounded-full bg-slate-700">
                    <div
                      className="h-full rounded-full bg-gradient-to-r from-cyan-400 to-blue-500"
                      style={{ width: `${result.admissionChance}%` }}
                    />
                  </div>

                  <p className="mt-3 text-3xl font-bold text-yellow-300">{result.status}</p>
                  <p className="mt-2 text-slate-300">{result.summary}</p>
                </div>

                <div className="grid gap-4">
                  {result.universityMatches?.map((item, index) => (
                    <UniversityCard key={index} item={item} />
                  ))}
                </div>

                <div className="rounded-2xl bg-slate-800 p-5">
                  <p className="mb-4 text-xl font-bold">AI Readiness Radar</p>
                  <div className="w-full" style={{ minWidth: 300, height: 300 }}>
                    <ResponsiveContainer width={300} height={300}>
                      <RadarChart data={radarData}>
                        <PolarGrid />
                        <PolarAngleAxis dataKey="subject" />
                        <PolarRadiusAxis />
                        <Radar
                          name="Score"
                          dataKey="value"
                          stroke="#22d3ee"
                          fill="#22d3ee"
                          fillOpacity={0.6}
                        />
                      </RadarChart>
                    </ResponsiveContainer>
                  </div>
                </div>

                <div className="rounded-2xl bg-slate-800 p-5">
                  <p className="mb-4 text-xl font-bold">AI Score Simulator</p>
                  <div className="w-full" style={{ minWidth: 300, height: 300 }}>
                    <ResponsiveContainer width={300} height={300}>
                      <BarChart data={simulationData}>
                        <XAxis dataKey="scenario" />
                        <YAxis />
                        <Tooltip />
                        <Bar dataKey="chance" radius={[8, 8, 0, 0]} />
                      </BarChart>
                    </ResponsiveContainer>
                  </div>
                </div>

                <Card title="Priority Subjects" items={result.prioritySubjects} />
                <Card title="Study Plan Today" items={result.todayPlan} />
                <Card title="7-Day Plan" items={result.sevenDayPlan} />
                <Card title="Risk Analysis" items={result.riskAnalysis} />

                <InfoCard title="Strategic Advice" text={result.strategicAdvice} color="cyan" />
                <InfoCard title="Next Action" text={result.nextAction} color="emerald" />
              </div>
            )}
          </div>
        </div>
      </div>
    </main>
  );
}

function Input({
  value,
  setValue,
  placeholder,
}: {
  value: string;
  setValue: (value: string) => void;
  placeholder: string;
}) {
  return (
    <input
      value={value}
      onChange={(e) => setValue(e.target.value)}
      placeholder={placeholder}
      className="w-full rounded-xl bg-slate-800 px-5 py-4 outline-none focus:ring-2 focus:ring-cyan-400"
    />
  );
}

function UniversityCard({ item }: { item: UniversityMatch }) {
  const color =
    item.type === "dream"
      ? "border-pink-500/40 bg-pink-500/10 text-pink-300"
      : item.type === "target"
      ? "border-yellow-500/40 bg-yellow-500/10 text-yellow-300"
      : "border-emerald-500/40 bg-emerald-500/10 text-emerald-300";

  const label =
    item.type === "dream" ? "Dream" : item.type === "target" ? "Target" : "Safe";

  return (
    <div className={`rounded-2xl border p-5 ${color}`}>
      <div className="mb-2 flex items-center justify-between">
        <p className="text-sm font-bold uppercase tracking-widest">{label}</p>
        <p className="text-xl font-black">{item.chance}%</p>
      </div>

      <p className="text-2xl font-bold text-white">{item.name}</p>
      
      {item.minScore !== undefined && item.minScore !== null && (
        <div className="mt-2 text-sm text-slate-300">
          คะแนนต่ำสุดปี {item.year}:
          <span className="ml-2 font-bold text-cyan-300">
            {item.minScore.toFixed(2)}
            </span>
            
            {item.maxScore !== undefined && item.maxScore !== null && (
              <>
              <span className="mx-2 text-slate-500">|</span>
              สูงสุด:
              <span className="ml-2 font-bold text-pink-300">
                {item.maxScore.toFixed(2)}
                </span>
                </>
            )}
          </div>
      )}

      <div className="my-3 h-3 overflow-hidden rounded-full bg-slate-700">
        <div className="h-full rounded-full bg-current" style={{ width: `${item.chance}%` }} />
      </div>

      <p className="text-sm leading-relaxed text-slate-200">
        {item.reason?.length > 180
          ? item.reason.slice(0, 180) + "..."
          : item.reason}
      </p>
    </div>
  );
}

function Card({ title, items }: { title: string; items: string[] }) {
  return (
    <div className="rounded-2xl bg-slate-800 p-5">
      <p className="mb-3 text-xl font-bold">{title}</p>
      <ul className="list-disc space-y-2 pl-5 text-slate-300">
        {items?.map((item, index) => (
          <li key={index}>{item}</li>
        ))}
      </ul>
    </div>
  );
}

function InfoCard({
  title,
  text,
  color,
}: {
  title: string;
  text: string;
  color: "cyan" | "emerald";
}) {
  const style =
    color === "cyan"
      ? "border-cyan-500/30 bg-cyan-500/10 text-cyan-300"
      : "border-emerald-500/30 bg-emerald-500/10 text-emerald-300";

  return (
    <div className={`rounded-2xl border p-5 ${style}`}>
      <p className="mb-2 text-xl font-bold">{title}</p>
      <p className="text-slate-200">{text}</p>
    </div>
  );
}