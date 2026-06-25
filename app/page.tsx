"use client";
import { useState, useRef, useCallback, useEffect } from "react";

const THEMES: Record<string, Record<string, string>> = {
  dark: {
    bg: "linear-gradient(135deg,#0f0f1a 0%,#1a1a2e 50%,#16213e 100%)",
    surface: "rgba(255,255,255,0.03)", surfaceCard: "rgba(255,255,255,0.05)",
    border: "#1e1e3a", borderMid: "#2d2d4e",
    text: "#e2e8f0", textMuted: "#9ca3af", textDim: "#6b7280", textFaint: "#4b5563",
    accent: "#6c63ff", accentLight: "#a78bfa", accentBg: "rgba(108,99,255,0.15)",
    inputBg: "rgba(255,255,255,0.05)", spinBorder: "#1e1e3a",
    cardSelected: "linear-gradient(135deg,#6c63ff,#a78bfa)", cardUnsel: "rgba(255,255,255,0.04)",
    headerBg: "rgba(15,15,26,0.85)",
    errorBg: "rgba(239,68,68,0.1)", errorBorder: "#ef4444", errorText: "#fca5a5",
    successBg: "rgba(34,197,94,0.15)", successBorder: "#166534", successText: "#4ade80",
    tagBg: "rgba(108,99,255,0.1)",
  },
  light: {
    bg: "linear-gradient(135deg,#f0f4ff 0%,#e8eeff 50%,#f5f0ff 100%)",
    surface: "rgba(255,255,255,0.85)", surfaceCard: "rgba(255,255,255,0.95)",
    border: "#dde3f5", borderMid: "#c8d0eb",
    text: "#1e1b4b", textMuted: "#374151", textDim: "#6b7280", textFaint: "#9ca3af",
    accent: "#6c63ff", accentLight: "#7c6fcd", accentBg: "rgba(108,99,255,0.08)",
    inputBg: "rgba(255,255,255,0.9)", spinBorder: "#dde3f5",
    cardSelected: "linear-gradient(135deg,#6c63ff,#a78bfa)", cardUnsel: "rgba(255,255,255,0.7)",
    headerBg: "rgba(240,244,255,0.85)",
    errorBg: "rgba(239,68,68,0.08)", errorBorder: "#f87171", errorText: "#dc2626",
    successBg: "rgba(34,197,94,0.1)", successBorder: "#16a34a", successText: "#15803d",
    tagBg: "rgba(108,99,255,0.08)",
  },
};

const MODES = [
  { id:"qa",          label:"Q&A",           icon:"Q",  desc:"Ask questions grounded in your document"  },
  { id:"studyguide",  label:"Study Guide",    icon:"SG", desc:"Generate structured study guides"         },
  { id:"faq",         label:"FAQ",            icon:"F",  desc:"Auto-generate FAQs from content"          },
  { id:"timeline",    label:"Timeline",       icon:"TL", desc:"Extract chronological events"             },
  { id:"podcast",     label:"Podcast Script", icon:"P",  desc:"Create conversational podcast scripts"    },
  { id:"compare",     label:"Compare Docs",   icon:"CD", desc:"Side-by-side multi-document comparison"   },
];

const SYSTEM_PROMPTS: Record<string, string> = {
  qa:`You are a precise research assistant. Answer the user question strictly using the provided document content. Always cite specific parts. If the answer is not in the document, say so clearly. Use clear sections and bullets.`,
  studyguide:`You are an expert educator. Create a comprehensive study guide with: 1. Key Concepts (with definitions) 2. Main Themes and Arguments 3. Important Facts and Data Points 4. Critical Insights 5. Review Questions (5 Q&As). Use headers, bullets, and clear formatting.`,
  faq:`You are a content strategist. Generate a well-structured FAQ with 8-10 questions. Format each as: Q: [Question] A: [Concise accurate answer]. Cover the most important topics a reader would want to understand.`,
  timeline:`You are a historian and analyst. Extract all chronological events, dates, and sequences. Create a detailed timeline ordered chronologically. If no dates, use: First, Then, Later, Finally.`,
  podcast:`You are a podcast producer. Transform the document into an engaging 2-host script. Hosts: Alex (analytical) and Sam (curious). Make it conversational, educational, with natural transitions.`,
  compare:`You are a comparative analyst. Compare the provided documents across: 1. Core Thesis 2. Key Evidence and Data 3. Points of Agreement 4. Points of Disagreement 5. Unique Contributions per doc 6. Synthesis and Conclusion. Be specific and cite each document by name.`,
};

async function readFileFn(file: File): Promise<string> {
  if (file.name.endsWith(".pdf")) {
    return new Promise((resolve) => {
      const reader = new FileReader();
      reader.onload = async (e) => {
        try {
          const pdfjsLib = (window as any)["pdfjs-dist/build/pdf"];
          if (!pdfjsLib) { resolve("[PDF.js not loaded yet - try again in a moment]"); return; }
          pdfjsLib.GlobalWorkerOptions.workerSrc = "https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.worker.min.js";
          const pdf = await pdfjsLib.getDocument({ data: new Uint8Array(e.target!.result as ArrayBuffer) }).promise;
          let text = "";
          for (let i = 1; i <= Math.min(pdf.numPages, 30); i++) {
            const page = await pdf.getPage(i);
            const content = await page.getTextContent();
            text += content.items.map((s: any) => s.str).join(" ") + "\n\n";
          }
          resolve(text.trim() || "[No extractable text in PDF]");
        } catch { resolve("[Error reading PDF]"); }
      };
      reader.readAsArrayBuffer(file);
    });
  }
  return file.text();
}

function exportTXT(text: string, filename: string) {
  const a = document.createElement("a");
  a.href = URL.createObjectURL(new Blob([text], { type: "text/plain" }));
  a.download = filename + ".txt"; a.click();
}

function exportHTML(text: string, title: string) {
  const escaped = text.replace(/&/g,"&amp;").replace(/</g,"&lt;").replace(/>/g,"&gt;").replace(/\n/g,"<br/>");
  const html = `<!DOCTYPE html><html><head><meta charset="UTF-8"><title>${title}</title>
<style>body{font-family:sans-serif;max-width:800px;margin:40px auto;padding:0 24px;background:#0f0f1a;color:#e2e8f0;line-height:1.8;}h1{color:#a78bfa;}</style>
</head><body><h1>${title}</h1><p style="color:#6b7280;font-size:13px">${new Date().toLocaleString()}</p><div>${escaped}</div></body></html>`;
  const a = document.createElement("a");
  a.href = URL.createObjectURL(new Blob([html], { type: "text/html" }));
  a.download = title.replace(/\s+/g,"-") + ".html"; a.click();
}

function exportRTF(text: string, title: string) {
  const esc = text.replace(/\\/g,"\\\\").replace(/\{/g,"\\{").replace(/\}/g,"\\}");
  let body = "";
  for (const line of esc.split("\n")) {
    if (line.startsWith("## ")) body += `{\\pard\\b\\fs28 ${line.slice(3)}\\b0\\par}\n`;
    else if (line.startsWith("# ")) body += `{\\pard\\b\\fs36 ${line.slice(2)}\\b0\\par}\n`;
    else if (line.startsWith("- ")) body += `{\\pard\\li360 - ${line.slice(2)}\\par}\n`;
    else if (line.trim()==="") body += `{\\pard\\par}\n`;
    else body += `{\\pard ${line}\\par}\n`;
  }
  const rtf = `{\\rtf1\\ansi\\deff0{\\fonttbl{\\f0 Calibri;}}\\f0\\fs24{\\pard\\b\\fs40 ${title}\\b0\\par}{\\pard ${new Date().toLocaleString()}\\par}${body}}`;
  const a = document.createElement("a");
  a.href = URL.createObjectURL(new Blob([rtf], { type: "application/rtf" }));
  a.download = title.replace(/\s+/g,"-") + ".rtf"; a.click();
}

function MarkdownRenderer({ text, theme }: { text: string; theme: string }) {
  const t = THEMES[theme];
  return (
    <div style={{ lineHeight:1.8 }}>
      {text.split("\n").map((line, i) => {
        if (line.startsWith("## ")) return <h2 key={i} style={{ color:t.accentLight, marginTop:20, marginBottom:6, fontSize:17 }}>{line.slice(3)}</h2>;
        if (line.startsWith("# "))  return <h1 key={i} style={{ color:t.text, marginTop:24, marginBottom:8, fontSize:20 }}>{line.slice(2)}</h1>;
        if (/^\*\*(.+)\*\*$/.test(line.trim())) return <p key={i} style={{ color:t.text, fontWeight:700, margin:"12px 0 4px" }}>{line.trim().slice(2,-2)}</p>;
        if (line.startsWith("- ")) return <li key={i} style={{ color:t.textMuted, marginLeft:20, marginBottom:4 }}>{line.slice(2)}</li>;
        if (/^\d+\./.test(line)) return <li key={i} style={{ color:t.textMuted, marginLeft:20, marginBottom:4 }}>{line.replace(/^\d+\.\s*/,"")}</li>;
        if (line.startsWith("Q:")) return <p key={i} style={{ color:t.text, fontWeight:700, margin:"12px 0 2px" }}>{line}</p>;
        if (line.startsWith("A:")) return <p key={i} style={{ color:t.textMuted, margin:"0 0 10px", paddingLeft:12, borderLeft:`3px solid ${t.accent}` }}>{line}</p>;
        if (/^(ALEX|SAM):/.test(line)) {
          const colon = line.indexOf(":");
          const sp = line.slice(0,colon);
          return (
            <p key={i} style={{ margin:"8px 0", paddingLeft:12, borderLeft:`3px solid ${sp==="ALEX"?t.accent:"#f59e0b"}` }}>
              <span style={{ color:sp==="ALEX"?t.accent:"#f59e0b", fontWeight:700, marginRight:6 }}>{sp}:</span>
              <span style={{ color:t.textMuted }}>{line.slice(colon+1)}</span>
            </p>
          );
        }
        if (line.trim()==="") return <br key={i}/>;
        return <p key={i} style={{ color:t.textMuted, margin:"4px 0" }}>{line}</p>;
      })}
    </div>
  );
}

function FileUploader({ label, onFileParsed, theme, compact }: { label?: string; onFileParsed: (text: string, name: string) => void; theme: string; compact?: boolean }) {
  const t = THEMES[theme];
  const [dragging, setDragging] = useState(false);
  const [fileName, setFileName] = useState("");
  const [parsing, setParsing] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  const handleFile = async (file: File) => {
    if (!file) return;
    setFileName(file.name); setParsing(true);
    const text = await readFileFn(file);
    onFileParsed(text, file.name);
    setParsing(false);
  };

  return (
    <div
      onDragOver={e=>{e.preventDefault();setDragging(true);}}
      onDragLeave={()=>setDragging(false)}
      onDrop={e=>{e.preventDefault();setDragging(false);if(e.dataTransfer.files[0])handleFile(e.dataTransfer.files[0]);}}
      onClick={()=>inputRef.current?.click()}
      style={{ border:`2px dashed ${dragging?t.accent:t.borderMid}`, borderRadius:12, padding:compact?"14px":"24px 18px", textAlign:"center", cursor:"pointer", background:dragging?t.accentBg:t.inputBg, transition:"all 0.2s" }}
    >
      <input ref={inputRef} type="file" accept=".txt,.md,.csv,.json,.html,.js,.py,.pdf" style={{display:"none"}} onChange={e=>{if(e.target.files?.[0])handleFile(e.target.files[0]);}}/>
      <div style={{ fontSize:compact?20:28, marginBottom:6 }}>{parsing?"...":"D"}</div>
      {fileName
        ? <p style={{ color:t.accent, fontWeight:600, margin:0, fontSize:12 }}>OK: {fileName}</p>
        : <><p style={{ color:t.accentLight, fontWeight:600, margin:"0 0 3px", fontSize:12 }}>{label||"Drop or click to upload"}</p>
            <p style={{ color:t.textDim, fontSize:10, margin:0 }}>.pdf .txt .md .csv .json</p></>
      }
    </div>
  );
}

function ModeCard({ mode, selected, onClick, theme }: { mode: typeof MODES[0]; selected: boolean; onClick: () => void; theme: string }) {
  const t = THEMES[theme];
  return (
    <button onClick={onClick} style={{ background:selected?t.cardSelected:t.cardUnsel, border:`1.5px solid ${selected?t.accent:t.borderMid}`, borderRadius:10, padding:"10px 6px", cursor:"pointer", textAlign:"center", transition:"all 0.18s", transform:selected?"scale(1.04)":"scale(1)", boxShadow:selected?`0 4px 14px ${t.accent}44`:"none", color:"inherit" }}>
      <div style={{ fontSize:10, fontWeight:700, color:selected?"#fff":t.accentLight, marginBottom:3 }}>[{mode.icon}]</div>
      <div style={{ fontSize:10, fontWeight:700, color:selected?"#fff":t.accentLight }}>{mode.label}</div>
    </button>
  );
}

interface HistoryItem { mode: string; docNames: string[]; question: string; output: string; time: string; }

function HistoryPanel({ history, onRestore, onClear, theme }: { history: HistoryItem[]; onRestore: (item: HistoryItem) => void; onClear: () => void; theme: string }) {
  const t = THEMES[theme];
  if (!history.length) return (
    <div style={{ textAlign:"center", padding:"28px 12px", color:t.textDim }}>
      <p style={{ fontSize:12, margin:0 }}>No history yet</p>
      <p style={{ fontSize:10, margin:"4px 0 0", color:t.textFaint }}>Generations appear here</p>
    </div>
  );
  return (
    <div>
      <div style={{ display:"flex", justifyContent:"space-between", alignItems:"center", marginBottom:10 }}>
        <span style={{ fontSize:11, color:t.textDim, fontWeight:600 }}>{history.length} session{history.length!==1?"s":""}</span>
        <button onClick={onClear} style={{ background:"none", border:"none", color:t.textFaint, fontSize:10, cursor:"pointer", textDecoration:"underline" }}>Clear all</button>
      </div>
      <div style={{ display:"flex", flexDirection:"column", gap:7 }}>
        {[...history].reverse().map((item,i)=>(
          <div key={i} onClick={()=>onRestore(item)}
            style={{ background:t.surface, border:`1px solid ${t.border}`, borderRadius:10, padding:10, cursor:"pointer" }}
          >
            <div style={{ display:"flex", justifyContent:"space-between", marginBottom:4 }}>
              <span style={{ fontSize:10, fontWeight:700, color:t.accentLight }}>{MODES.find(m=>m.id===item.mode)?.label}</span>
              <span style={{ fontSize:10, color:t.textFaint }}>{item.time}</span>
            </div>
            {item.docNames?.length>0 && <p style={{ fontSize:10, color:t.textDim, margin:"0 0 3px", overflow:"hidden", textOverflow:"ellipsis", whiteSpace:"nowrap" }}>Doc: {item.docNames.join(", ")}</p>}
            {item.question && <p style={{ fontSize:11, color:t.text, margin:"0 0 3px", fontStyle:"italic" }}>"{item.question.slice(0,55)}{item.question.length>55?"...":""}"</p>}
            <p style={{ fontSize:10, color:t.textDim, margin:0, overflow:"hidden", display:"-webkit-box", WebkitLineClamp:2, WebkitBoxOrient:"vertical" } as React.CSSProperties}>{item.output.slice(0,90)}...</p>
          </div>
        ))}
      </div>
    </div>
  );
}

function ExportBar({ output, title, theme }: { output: string; title: string; theme: string }) {
  const t = THEMES[theme];
  const [copied, setCopied] = useState(false);
  const btn = (label: string, onClick: () => void) => (
    <button onClick={onClick} style={{ background:t.accentBg, border:`1px solid ${t.accent}`, borderRadius:8, padding:"5px 10px", color:t.accentLight, fontSize:11, cursor:"pointer", fontWeight:600 }}>
      {label}
    </button>
  );
  return (
    <div style={{ display:"flex", gap:6, flexWrap:"wrap" }}>
      {btn(copied?"Copied!":"Copy", ()=>{navigator.clipboard.writeText(output);setCopied(true);setTimeout(()=>setCopied(false),2000);})}
      {btn(".TXT",  ()=>exportTXT(output, title))}
      {btn(".HTML", ()=>exportHTML(output, title))}
      {btn("Word",  ()=>exportRTF(output, title))}
    </div>
  );
}

interface CompareDoc { id: number; name: string; text: string; notes: string; }

function ComparePanel({ theme, onDocumentsReady }: { theme: string; onDocumentsReady: (docs: CompareDoc[]) => void }) {
  const t = THEMES[theme];
  const [docs, setDocs] = useState<CompareDoc[]>([
    { id:1, name:"", text:"", notes:"" },
    { id:2, name:"", text:"", notes:"" },
  ]);
  const update = (id: number, patch: Partial<CompareDoc>) => setDocs(d=>d.map(doc=>doc.id===id?{...doc,...patch}:doc));

  useEffect(()=>{ onDocumentsReady(docs); }, [docs]);

  return (
    <div>
      <div style={{ display:"grid", gridTemplateColumns:"1fr 1fr", gap:10, marginBottom:10 }}>
        {docs.map((doc,idx)=>(
          <div key={doc.id} style={{ background:t.surface, border:`1px solid ${t.border}`, borderRadius:12, padding:12 }}>
            <p style={{ margin:"0 0 8px", fontSize:10, fontWeight:700, color:t.accentLight }}>Document {idx+1} {doc.name && `- ${doc.name}`}</p>
            <FileUploader compact theme={theme} label={`Upload Doc ${idx+1}`} onFileParsed={(text,name)=>update(doc.id,{text,name})}/>
            <textarea placeholder={`Or paste Doc ${idx+1} here...`} value={doc.notes} onChange={e=>update(doc.id,{notes:e.target.value})}
              style={{ width:"100%", minHeight:70, marginTop:8, background:t.inputBg, border:`1px solid ${t.borderMid}`, borderRadius:8, padding:8, color:t.text, fontSize:12, resize:"vertical", outline:"none", boxSizing:"border-box", fontFamily:"inherit" }}/>
            {(doc.text||doc.notes) && <p style={{ margin:"5px 0 0", fontSize:10, color:t.successText }}>Ready: {doc.text ? `${(doc.text.length/1000).toFixed(1)}k chars` : `${doc.notes.length} chars`}</p>}
          </div>
        ))}
      </div>
      {docs.length<4 && (
        <button onClick={()=>setDocs(d=>[...d,{id:Date.now(),name:"",text:"",notes:""}])}
          style={{ background:t.accentBg, border:`1px dashed ${t.accent}`, borderRadius:8, padding:"7px 14px", color:t.accentLight, fontSize:12, cursor:"pointer", fontWeight:600, width:"100%" }}>
          + Add Document ({docs.length}/4)
        </button>
      )}
    </div>
  );
}

async function callClaude(systemPrompt: string, userPrompt: string, onChunk: (t: string) => void, onDone: (t: string) => void, onError: (e: string) => void) {
  try {
    const res = await fetch("https://api.anthropic.com/v1/messages", {
      method:"POST",
      headers:{ "Content-Type":"application/json" },
      body: JSON.stringify({ model:"claude-sonnet-4-6", max_tokens:1000, system:systemPrompt, messages:[{role:"user",content:userPrompt}] }),
    });
    const data = await res.json();
    if (data.error) throw new Error(data.error.message);
    const full = (data.content||[]).map((b: any)=>b.text||"").join("");
    const words = full.split(" ");
    let built = "";
    for (let i=0;i<words.length;i++) {
      built += (i===0?"": " ") + words[i];
      onChunk(built);
      await new Promise(r=>setTimeout(r,16));
    }
    onDone(full);
  } catch(e: any) { onError(e.message); }
}

export default function App() {
  const [theme, setTheme]         = useState("dark");
  const [docText, setDocText]     = useState("");
  const [docName, setDocName]     = useState("");
  const [notes, setNotes]         = useState("");
  const [mode, setMode]           = useState("qa");
  const [question, setQuestion]   = useState("");
  const [output, setOutput]       = useState("");
  const [streaming, setStreaming] = useState(false);
  const [error, setError]         = useState("");
  const [history, setHistory]     = useState<HistoryItem[]>([]);
  const [activeTab, setActiveTab] = useState("input");
  const [compareDocs, setCompareDocs] = useState<CompareDoc[]>([]);
  const outputRef = useRef<HTMLDivElement>(null);
  const t = THEMES[theme];

  useEffect(()=>{
    if (!(window as any)["pdfjs-dist/build/pdf"]) {
      const s = document.createElement("script");
      s.src = "https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.min.js";
      document.head.appendChild(s);
    }
  },[]);

  const buildPrompt = useCallback(()=>{
    if (mode==="compare") {
      const ready = compareDocs.filter(d=>d.text||d.notes);
      if (ready.length<2) return null;
      const parts = ready.map((d,i)=>`=== ${d.name||`Document ${i+1}`} ===\n${(d.text||d.notes).slice(0,3000)}`);
      return parts.join("\n\n") + (question?`\n\nFOCUS: ${question}`:"");
    }
    const parts = [];
    if (docText) parts.push(`=== DOCUMENT: ${docName} ===\n${docText.slice(0,4000)}`);
    if (notes)   parts.push(`=== NOTES ===\n${notes}`);
    if (!parts.length) return null;
    const src = parts.join("\n\n");
    if (mode==="qa") return `${src}\n\nQUESTION: ${question}`;
    return `${src}\n\nTASK: Generate the requested output from the above content.`;
  },[docText,docName,notes,mode,question,compareDocs]);

  const handleGenerate = async () => {
    const prompt = buildPrompt();
    if (!prompt) { setError("Please upload a document or add notes first."); return; }
    if (mode==="qa"&&!question.trim()) { setError("Please enter a question."); return; }
    setStreaming(true); setOutput(""); setError("");
    await callClaude(
      SYSTEM_PROMPTS[mode], prompt,
      (text)=>{ setOutput(text); outputRef.current?.scrollTo({top:outputRef.current.scrollHeight,behavior:"smooth"}); },
      (text)=>{ setStreaming(false); setHistory(h=>[...h,{ mode, docNames:docName?[docName]:[], question, output:text, time:new Date().toLocaleTimeString([],{hour:"2-digit",minute:"2-digit"}) }]); },
      (msg)=>{ setError("Error: "+msg); setStreaming(false); }
    );
  };

  const canGenerate = mode==="compare"
    ? compareDocs.filter(d=>d.text||d.notes).length>=2
    : (docText||notes)&&(mode!=="qa"||question.trim());

  const modeLabel = MODES.find(m=>m.id===mode)?.label||"";

  return (
    <div style={{ minHeight:"100vh", background:t.bg, fontFamily:"'Inter','Segoe UI',sans-serif", color:t.text }}>
      <style>{`*{box-sizing:border-box;}@keyframes spin{to{transform:rotate(360deg)}}@keyframes pulse{0%,100%{opacity:1}50%{opacity:0.4}}.blink::after{content:"|";animation:pulse 0.8s infinite;color:#a78bfa;margin-left:2px}`}</style>

      {/* HEADER */}
      <div style={{ borderBottom:`1px solid ${t.border}`, padding:"14px 24px", display:"flex", alignItems:"center", gap:12, background:t.headerBg, backdropFilter:"blur(12px)", position:"sticky", top:0, zIndex:20 }}>
        <div>
          <h1 style={{ margin:0, fontSize:16, fontWeight:800, background:"linear-gradient(90deg,#a78bfa,#6c63ff)", WebkitBackgroundClip:"text", WebkitTextFillColor:"transparent" }}>AI Research Assistant</h1>
          <p style={{ margin:0, fontSize:10, color:t.textDim }}>Source-grounded - Streaming - Multi-doc - Export</p>
        </div>
        <div style={{ marginLeft:"auto", display:"flex", gap:8, alignItems:"center" }}>
          {docName&&mode!=="compare"&&<div style={{ background:t.accentBg, border:`1px solid ${t.accent}`, borderRadius:8, padding:"3px 10px", fontSize:10, color:t.accentLight }}>Doc: {docName}</div>}
          {history.length>0&&<div style={{ background:t.tagBg, border:`1px solid ${t.border}`, borderRadius:8, padding:"3px 10px", fontSize:10, color:t.textDim }}>{history.length} saved</div>}
          <button onClick={()=>setTheme(th=>th==="dark"?"light":"dark")} style={{ background:t.surface, border:`1px solid ${t.border}`, borderRadius:20, padding:"5px 14px", cursor:"pointer", color:t.text, fontSize:12, fontWeight:600 }}>
            {theme==="dark"?"Light":"Dark"} Mode
          </button>
        </div>
      </div>

      {/* BODY */}
      <div style={{ maxWidth:1300, margin:"0 auto", padding:"20px 16px", display:"grid", gridTemplateColumns:"300px 1fr 230px", gap:16 }}>

        {/* LEFT */}
        <div style={{ display:"flex", flexDirection:"column", gap:12 }}>
          <div style={{ display:"flex", gap:3, background:t.surface, borderRadius:12, padding:4, border:`1px solid ${t.border}` }}>
            {["input","history"].map(tab=>(
              <button key={tab} onClick={()=>setActiveTab(tab)} style={{ flex:1, padding:"7px 4px", border:"none", borderRadius:9, cursor:"pointer", fontWeight:600, fontSize:11, background:activeTab===tab?t.accent:"transparent", color:activeTab===tab?"#fff":t.textMuted }}>
                {tab==="input"?"Setup":`History ${history.length>0?`(${history.length})`:""}`}
              </button>
            ))}
          </div>

          {activeTab==="history" ? (
            <div style={{ background:t.surface, borderRadius:14, padding:14, border:`1px solid ${t.border}`, overflowY:"auto", maxHeight:"calc(100vh - 180px)" }}>
              <HistoryPanel history={history} onRestore={item=>{setMode(item.mode);if(item.question)setQuestion(item.question);setOutput(item.output);setActiveTab("input");}} onClear={()=>setHistory([])} theme={theme}/>
            </div>
          ) : (<>
            <div style={{ background:t.surface, borderRadius:14, padding:14, border:`1px solid ${t.border}` }}>
              <p style={{ margin:"0 0 10px", fontSize:10, fontWeight:700, color:t.textDim, textTransform:"uppercase", letterSpacing:"0.08em" }}>Output Mode</p>
              <div style={{ display:"grid", gridTemplateColumns:"1fr 1fr 1fr", gap:6, marginBottom:8 }}>
                {MODES.map(m=><ModeCard key={m.id} mode={m} selected={mode===m.id} theme={theme} onClick={()=>{setMode(m.id);setOutput("");setError("");}}/>)}
              </div>
              <p style={{ fontSize:10, color:t.textDim, margin:0, textAlign:"center" }}>{MODES.find(m=>m.id===mode)?.desc}</p>
            </div>

            {mode==="compare" ? (
              <div style={{ background:t.surface, borderRadius:14, padding:14, border:`1px solid ${t.border}` }}>
                <p style={{ margin:"0 0 10px", fontSize:10, fontWeight:700, color:t.textDim, textTransform:"uppercase", letterSpacing:"0.08em" }}>Documents to Compare</p>
                <ComparePanel theme={theme} onDocumentsReady={setCompareDocs}/>
                <textarea value={question} onChange={e=>setQuestion(e.target.value)} placeholder="Optional: specific focus for comparison..."
                  style={{ width:"100%", minHeight:60, marginTop:10, background:t.inputBg, border:`1px solid ${t.borderMid}`, borderRadius:8, padding:8, color:t.text, fontSize:12, resize:"vertical", outline:"none", fontFamily:"inherit" }}/>
              </div>
            ) : (<>
              <div style={{ background:t.surface, borderRadius:14, padding:14, border:`1px solid ${t.border}` }}>
                <p style={{ margin:"0 0 10px", fontSize:10, fontWeight:700, color:t.textDim, textTransform:"uppercase", letterSpacing:"0.08em" }}>Source Document</p>
                <FileUploader theme={theme} onFileParsed={(text,name)=>{setDocText(text);setDocName(name);setOutput("");setError("");}}/>
              </div>
              <div style={{ background:t.surface, borderRadius:14, padding:14, border:`1px solid ${t.border}` }}>
                <p style={{ margin:"0 0 8px", fontSize:10, fontWeight:700, color:t.textDim, textTransform:"uppercase", letterSpacing:"0.08em" }}>Paste Notes</p>
                <textarea value={notes} onChange={e=>setNotes(e.target.value)} placeholder="Or paste text / notes directly..."
                  style={{ width:"100%", minHeight:90, background:t.inputBg, border:`1px solid ${t.borderMid}`, borderRadius:8, padding:8, color:t.text, fontSize:12, resize:"vertical", outline:"none", fontFamily:"inherit" }}/>
              </div>
              {mode==="qa"&&(
                <div style={{ background:t.surface, borderRadius:14, padding:14, border:`1px solid ${t.border}` }}>
                  <p style={{ margin:"0 0 8px", fontSize:10, fontWeight:700, color:t.textDim, textTransform:"uppercase", letterSpacing:"0.08em" }}>Your Question</p>
                  <textarea value={question} onChange={e=>setQuestion(e.target.value)} placeholder="What would you like to know?"
                    onKeyDown={e=>{if(e.key==="Enter"&&(e.metaKey||e.ctrlKey))handleGenerate();}}
                    style={{ width:"100%", minHeight:70, background:t.inputBg, border:`1px solid ${t.borderMid}`, borderRadius:8, padding:8, color:t.text, fontSize:12, resize:"vertical", outline:"none", fontFamily:"inherit" }}/>
                  <p style={{ fontSize:10, color:t.textFaint, margin:"4px 0 0" }}>Ctrl+Enter to submit</p>
                </div>
              )}
            </>)}

            <button onClick={handleGenerate} disabled={!canGenerate||streaming}
              style={{ background:canGenerate&&!streaming?"linear-gradient(135deg,#6c63ff,#a78bfa)":t.surface, border:`1.5px solid ${canGenerate&&!streaming?t.accent:t.border}`, borderRadius:12, padding:14, color:canGenerate&&!streaming?"#fff":t.textFaint, fontSize:13, fontWeight:700, cursor:canGenerate&&!streaming?"pointer":"not-allowed", width:"100%", transition:"all 0.2s" }}>
              {streaming ? "Generating..." : `Generate ${modeLabel}`}
            </button>
          </>)}
        </div>

        {/* CENTRE OUTPUT */}
        <div ref={outputRef} style={{ background:t.surface, borderRadius:14, border:`1px solid ${t.border}`, padding:22, minHeight:600, maxHeight:"calc(100vh - 100px)", overflowY:"auto", position:"relative" }}>
          {!output&&!streaming&&!error&&(
            <div style={{ position:"absolute", inset:0, display:"flex", flexDirection:"column", alignItems:"center", justifyContent:"center", gap:12, padding:24 }}>
              <h2 style={{ color:t.textFaint, fontSize:16, margin:0 }}>AI Research Assistant</h2>
              <p style={{ color:t.textDim, fontSize:12, margin:0, textAlign:"center", maxWidth:260 }}>Upload a document, choose a mode, and click Generate.</p>
              <div style={{ display:"flex", gap:7, flexWrap:"wrap", justifyContent:"center", marginTop:8 }}>
                {MODES.map(m=><span key={m.id} style={{ background:t.tagBg, border:`1px solid ${t.border}`, borderRadius:20, padding:"3px 10px", fontSize:11, color:t.textDim }}>{m.label}</span>)}
              </div>
              <div style={{ marginTop:16, padding:14, background:t.accentBg, borderRadius:12, border:`1px solid ${t.border}`, maxWidth:280 }}>
                <p style={{ fontSize:11, color:t.textMuted, margin:0, textAlign:"center" }}>Streaming output - PDF support - Multi-doc compare - Export TXT / HTML / Word</p>
              </div>
            </div>
          )}
          {streaming&&!output&&(
            <div style={{ display:"flex", flexDirection:"column", alignItems:"center", justifyContent:"center", height:400, gap:14 }}>
              <div style={{ width:40, height:40, border:`3px solid ${t.spinBorder}`, borderTop:`3px solid ${t.accent}`, borderRadius:"50%", animation:"spin 0.8s linear infinite" }}/>
              <p style={{ color:t.textDim, fontSize:13 }}>Generating response...</p>
            </div>
          )}
          {error&&<div style={{ background:t.errorBg, border:`1px solid ${t.errorBorder}`, borderRadius:10, padding:14, color:t.errorText, fontSize:13 }}>Error: {error}</div>}
          {output&&(
            <>
              <div style={{ display:"flex", justifyContent:"space-between", alignItems:"center", marginBottom:16, paddingBottom:12, borderBottom:`1px solid ${t.border}` }}>
                <div style={{ display:"flex", alignItems:"center", gap:8 }}>
                  <span style={{ fontWeight:700, color:t.accentLight }}>{modeLabel}</span>
                  {streaming
                    ? <span style={{ background:"rgba(108,99,255,0.2)", color:t.accentLight, fontSize:10, padding:"2px 8px", borderRadius:20 }}>Streaming...</span>
                    : <span style={{ background:t.successBg, color:t.successText, fontSize:10, padding:"2px 8px", borderRadius:20 }}>Complete</span>
                  }
                </div>
                {!streaming&&<div style={{display:"flex",gap:6,alignItems:"center"}}>
                  <ExportBar output={output} title={modeLabel} theme={theme}/>
                  <button onClick={()=>{setOutput("");setError("");}} style={{ background:t.surface, border:`1px solid ${t.border}`, borderRadius:8, padding:"4px 10px", color:t.textDim, fontSize:11, cursor:"pointer" }}>Clear</button>
                </div>}
              </div>
              <div className={streaming?"blink":""}>
                <MarkdownRenderer text={output} theme={theme}/>
              </div>
            </>
          )}
        </div>

        {/* RIGHT HISTORY */}
        <div style={{ background:t.surface, borderRadius:14, border:`1px solid ${t.border}`, padding:14, overflowY:"auto", maxHeight:"calc(100vh - 100px)" }}>
          <p style={{ margin:"0 0 12px", fontSize:10, fontWeight:700, color:t.textDim, textTransform:"uppercase", letterSpacing:"0.08em" }}>Session History</p>
          <HistoryPanel history={history} onRestore={item=>{setMode(item.mode);if(item.question)setQuestion(item.question);setOutput(item.output);setActiveTab("input");}} onClear={()=>setHistory([])} theme={theme}/>
        </div>
      </div>
    </div>
  );
}
