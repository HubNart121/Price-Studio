"use client";

import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ChangeEvent,
  type ReactNode,
} from "react";
import { useSearchParams } from "next/navigation";
import { signOut as firebaseSignOut } from "firebase/auth";
import { getDownloadURL, ref, uploadBytes } from "firebase/storage";
import { logout } from "@/app/actions";
import {
  getFirebaseClientAuth,
  getFirebaseClientStorage,
} from "@/lib/firebase/client";
import type { FirebaseWebConfig } from "@/lib/firebase/web-config";
import type {
  CategoryRecord,
  ProjectInput,
  ProjectRecord,
  VolumeTier,
} from "@/lib/domain/project";
import { createDefaultVolumeTiers } from "@/lib/domain/project";
import {
  calculatePricing,
  emptyPricingInput,
  type PricingResult,
} from "@/lib/domain/pricing";

type Tab = "calculator" | "projects" | "categories";

interface DashboardProps {
  user: {
    id: string;
    email: string;
    name: string | null;
    image: string | null;
  };
  initialProjectId?: string | null;
  firebaseConfig: FirebaseWebConfig | null;
}

const today = () => new Date().toISOString().slice(0, 10);

const newProject = (): ProjectInput => ({
  ...emptyPricingInput,
  categoryId: null,
  projectDate: today(),
  productName: "",
  productImageUrl: "",
  detail: "",
  currencyCode: "CNY",
  volumeTiers: createDefaultVolumeTiers(),
});

const baht = new Intl.NumberFormat("th-TH", {
  style: "currency",
  currency: "THB",
  minimumFractionDigits: 0,
  maximumFractionDigits: 2,
});

const number = new Intl.NumberFormat("th-TH", {
  maximumFractionDigits: 4,
});

const marginPercent = new Intl.NumberFormat("th-TH", {
  minimumFractionDigits: 2,
  maximumFractionDigits: 2,
});

const imageCurrency = new Intl.NumberFormat("th-TH", {
  minimumFractionDigits: 0,
  maximumFractionDigits: 2,
});

function escapeXml(value: string) {
  return value
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&apos;");
}

function wrapSvgText(value: string, maxChars: number, maxLines = 2) {
  const words = value.trim().split(/\s+/).filter(Boolean);
  const lines: string[] = [];
  let current = "";

  for (const word of words) {
    const next = current ? `${current} ${word}` : word;
    if (next.length <= maxChars) {
      current = next;
      continue;
    }

    if (current) {
      lines.push(current);
    }

    if (word.length > maxChars) {
      let chunk = "";
      for (const char of word) {
        const candidate = chunk + char;
        if (candidate.length > maxChars && chunk) {
          lines.push(chunk);
          chunk = char;
        } else {
          chunk = candidate;
        }
      }
      current = chunk;
    } else {
      current = word;
    }

    if (lines.length >= maxLines - 1) {
      break;
    }
  }

  if (current && lines.length < maxLines) {
    lines.push(current);
  }

  if (lines.length > maxLines) {
    lines.length = maxLines;
  }

  if (lines.length === 0) {
    lines.push(value.trim());
  }

  const lastIndex = lines.length - 1;
  if (lastIndex >= 0 && words.join(" ").length > lines.join(" ").length) {
    lines[lastIndex] = `${lines[lastIndex]}…`;
  }

  return lines;
}

function formatPercent(value: number) {
  return `${marginPercent.format(value)}%`;
}

function readImagePreview(file: File) {
  return new Promise<string>((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result ?? ""));
    reader.onerror = () => reject(new Error("อ่านไฟล์รูปภาพไม่สำเร็จ"));
    reader.readAsDataURL(file);
  });
}

function modeLabel(mode: ProjectInput["mode"]) {
  if (mode === "SIMPLE") return "โหมดง่าย";
  if (mode === "ADVANCED") return "โหมดละเอียด";
  return "โหมด Volume";
}

async function jsonRequest<T>(
  url: string,
  options?: RequestInit,
): Promise<T> {
  const response = await fetch(url, {
    ...options,
    headers: {
      "content-type": "application/json",
      ...options?.headers,
    },
  });
  const payload = await response.json().catch(() => ({}));
  if (!response.ok) {
    const issues = Array.isArray(payload.issues)
      ? `: ${payload.issues.join(", ")}`
      : "";
    throw new Error(`${payload.error ?? "เกิดข้อผิดพลาด"}${issues}`);
  }
  return payload as T;
}

function Field({
  label,
  value,
  onChange,
  suffix,
  min = 0,
  step = "any",
  hint,
}: {
  label: string;
  value: number;
  onChange: (value: number) => void;
  suffix?: string;
  min?: number;
  step?: number | "any";
  hint?: string;
}) {
  return (
    <label className="field">
      <span className="field-label">{label}</span>
      <span className="input-shell">
        <input
          inputMode="decimal"
          min={min}
          onChange={(event) => onChange(Number(event.target.value))}
          step={step}
          type="number"
          value={Number.isFinite(value) ? value : 0}
        />
        {suffix ? <span className="input-suffix">{suffix}</span> : null}
      </span>
      {hint ? <span className="field-hint">{hint}</span> : null}
    </label>
  );
}

function MetricCard({
  label,
  value,
  tone = "default",
  note,
}: {
  label: string;
  value: string;
  tone?: "default" | "accent" | "profit";
  note?: string;
}) {
  return (
    <article className={`metric-card ${tone}`}>
      <span>{label}</span>
      <strong>{value}</strong>
      {note ? <small>{note}</small> : null}
    </article>
  );
}

function SectionTitle({
  index,
  title,
  description,
}: {
  index: string;
  title: string;
  description?: string;
}) {
  return (
    <div className="section-heading">
      <span className="section-index">{index}</span>
      <div>
        <h2>{title}</h2>
        {description ? <p>{description}</p> : null}
      </div>
    </div>
  );
}

function Toast({
  message,
  kind,
}: {
  message: string;
  kind: "success" | "error";
}) {
  if (!message) return null;
  return (
    <div className={`toast ${kind}`} role="status">
      {kind === "success" ? "✓" : "!"} {message}
    </div>
  );
}

export default function Dashboard({
  user,
  initialProjectId,
  firebaseConfig,
}: DashboardProps) {
  const searchParams = useSearchParams();
  const urlProjectId = searchParams.get("projectId");
  const activeSharedProjectId = urlProjectId || initialProjectId || null;
  const [tab, setTab] = useState<Tab>("calculator");
  const [categories, setCategories] = useState<CategoryRecord[]>([]);
  const [projects, setProjects] = useState<ProjectRecord[]>([]);
  const [form, setForm] = useState<ProjectInput>(newProject);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [toast, setToast] = useState<{
    message: string;
    kind: "success" | "error";
  }>({ message: "", kind: "success" });
  const [search, setSearch] = useState("");
  const [filterCategory, setFilterCategory] = useState("");
  const [filterMode, setFilterMode] = useState("");
  const [newCategoryName, setNewCategoryName] = useState("");
  const [categoryDrafts, setCategoryDrafts] = useState<Record<string, string>>(
    {},
  );
  const [restoreMode, setRestoreMode] = useState<"merge" | "replace">("replace");
  const restoreInput = useRef<HTMLInputElement>(null);
  const productImageInput = useRef<HTMLInputElement>(null);
  const imageUploadVersion = useRef(0);
  const [productImagePreview, setProductImagePreview] = useState("");
  const [uploadingImage, setUploadingImage] = useState(false);
  const [volumeTiers, setVolumeTiers] =
    useState<VolumeTier[]>(createDefaultVolumeTiers);
  const appliedSharedProjectId = useRef<string | null>(null);

  const showToast = useCallback(
    (message: string, kind: "success" | "error" = "success") => {
      setToast({ message, kind });
      window.setTimeout(() => setToast({ message: "", kind }), 3500);
    },
    [],
  );

  const loadData = useCallback(async () => {
    try {
      const [categoryData, projectData] = await Promise.all([
        jsonRequest<CategoryRecord[]>("/api/categories"),
        jsonRequest<ProjectRecord[]>("/api/projects"),
      ]);
      setCategories(categoryData);
      setProjects(projectData);
      setCategoryDrafts(
        Object.fromEntries(categoryData.map((item) => [item.id, item.name])),
      );
      setForm((current) => ({
        ...current,
        categoryId:
          current.categoryId ??
          categoryData.find((category) => category.isActive)?.id ??
          null,
      }));
    } catch (error) {
      showToast(
        error instanceof Error ? error.message : "โหลดข้อมูลไม่สำเร็จ",
        "error",
      );
    } finally {
      setLoading(false);
    }
  }, [showToast]);

  useEffect(() => {
    void loadData();
  }, [loadData]);

  const result = useMemo<PricingResult | null>(() => {
    try {
      return calculatePricing(form);
    } catch {
      return null;
    }
  }, [form]);
  const displayedProductImage = productImagePreview || form.productImageUrl;

  const filteredProjects = useMemo(() => {
    const query = search.trim().toLowerCase();
    return projects.filter((project) => {
      const matchesText =
        !query ||
        project.productName.toLowerCase().includes(query) ||
        project.detail.toLowerCase().includes(query);
      const matchesCategory =
        !filterCategory || project.categoryId === filterCategory;
      const matchesMode = !filterMode || project.mode === filterMode;
      return matchesText && matchesCategory && matchesMode;
    });
  }, [filterCategory, filterMode, projects, search]);

  const volumeRows = useMemo(() => {
    const basePrice = result?.sellingPricePerUnit ?? 0;
    const costPerUnit = result?.costPerUnit ?? 0;
    return volumeTiers.map((tier) => {
      const price = basePrice * (1 - tier.discount / 100);
      const profit = price - costPerUnit;
      const margin = price > 0 ? (profit / price) * 100 : 0;
      const totalMargin = tier.quantity > 0 ? profit * tier.quantity : null;
      return {
        ...tier,
        price,
        profit,
        margin,
        totalMargin,
      };
    });
  }, [result?.costPerUnit, result?.sellingPricePerUnit, volumeTiers]);

  const setNumber = (key: keyof ProjectInput, value: number) => {
    setForm((current) => ({ ...current, [key]: value }));
  };

  const setVolumeTier = (
    index: number,
    field: keyof VolumeTier,
    value: string | number,
  ) => {
    setVolumeTiers((current) =>
      current.map((tier, tierIndex) =>
        tierIndex === index
          ? { ...tier, [field]: value } as VolumeTier
          : tier,
      ),
    );
  };

  const addVolumeTier = () => {
    setVolumeTiers((current) => [
      ...current,
      { qty: "ใหม่", quantity: 0, discount: 0 },
    ]);
  };

  const removeVolumeTier = (index: number) => {
    setVolumeTiers((current) =>
      current.length > 1
        ? current.filter((_, tierIndex) => tierIndex !== index)
        : current,
    );
  };

  const uploadProductImage = async (event: ChangeEvent<HTMLInputElement>) => {
    const input = event.currentTarget;
    const image = input.files?.[0];
    input.value = "";
    if (!image) return;

    if (
      !["image/jpeg", "image/png", "image/webp", "image/gif"].includes(
        image.type,
      )
    ) {
      showToast("รองรับเฉพาะไฟล์ JPG, PNG, WebP และ GIF", "error");
      return;
    }
    if (image.size > 5 * 1024 * 1024) {
      showToast("ไฟล์รูปภาพต้องมีขนาดไม่เกิน 5 MB", "error");
      return;
    }

    const uploadVersion = ++imageUploadVersion.current;
    setUploadingImage(true);
    try {
      setProductImagePreview(await readImagePreview(image));
      if (!firebaseConfig?.storageBucket) {
        throw new Error("ยังไม่ได้ตั้งค่า Firebase Storage");
      }

      const auth = getFirebaseClientAuth(firebaseConfig);
      await auth.authStateReady();
      const firebaseUser = auth.currentUser;
      if (!firebaseUser) {
        throw new Error("กรุณาออกจากระบบแล้วเข้าสู่ระบบใหม่อีกครั้ง");
      }

      const extensions: Record<string, string> = {
        "image/jpeg": "jpg",
        "image/png": "png",
        "image/webp": "webp",
        "image/gif": "gif",
      };
      const imageId = crypto.randomUUID();
      const imageRef = ref(
        getFirebaseClientStorage(firebaseConfig),
        `users/${firebaseUser.uid}/product-images/${imageId}.${extensions[image.type]}`,
      );
      await uploadBytes(imageRef, image, {
        contentType: image.type,
        cacheControl: "public,max-age=31536000,immutable",
      });
      const imageUrl = await getDownloadURL(imageRef);

      if (imageUploadVersion.current !== uploadVersion) return;
      setForm((current) => ({ ...current, productImageUrl: imageUrl }));
      setProductImagePreview("");
      showToast("อัปโหลดรูปภาพเรียบร้อย");
    } catch (error) {
      if (imageUploadVersion.current !== uploadVersion) return;
      setProductImagePreview("");
      showToast(
        error instanceof Error ? error.message : "อัปโหลดรูปภาพไม่สำเร็จ",
        "error",
      );
    } finally {
      if (imageUploadVersion.current === uploadVersion) {
        setUploadingImage(false);
      }
    }
  };

  const clearProductImage = () => {
    imageUploadVersion.current += 1;
    setUploadingImage(false);
    setProductImagePreview("");
    if (productImageInput.current) productImageInput.current.value = "";
    setForm((current) => ({ ...current, productImageUrl: "" }));
  };

  const logoutUser = async () => {
    if (!firebaseConfig) return;

    try {
      await firebaseSignOut(getFirebaseClientAuth(firebaseConfig));
      await fetch("/api/auth/firebase/session", { method: "DELETE" });
    } finally {
      window.location.assign("/");
    }
  };

  const resetForm = () => {
    setEditingId(null);
    setProductImagePreview("");
    setVolumeTiers(createDefaultVolumeTiers());
    setForm({
      ...newProject(),
      categoryId:
        categories.find((category) => category.isActive)?.id ?? null,
    });
  };

  const saveProject = async () => {
    if (!form.productName.trim()) {
      showToast("กรุณาระบุชื่อสินค้า", "error");
      return;
    }
    if (!result) {
      showToast("กรุณาตรวจจำนวน อัตราแลกเปลี่ยน และ GP Margin", "error");
      return;
    }
    if (uploadingImage) {
      showToast("กรุณารอให้อัปโหลดรูปภาพเสร็จก่อน", "error");
      return;
    }
    setSaving(true);
    try {
      const saved = await jsonRequest<ProjectRecord>(
        editingId ? `/api/projects/${editingId}` : "/api/projects",
        {
          method: editingId ? "PATCH" : "POST",
          body: JSON.stringify({ ...form, volumeTiers }),
        },
      );
      setProjects((current) => {
        const withoutSaved = current.filter((item) => item.id !== saved.id);
        return [saved, ...withoutSaved];
      });
      setEditingId(saved.id);
      showToast("บันทึกโปรเจกต์เรียบร้อย");
    } catch (error) {
      showToast(
        error instanceof Error ? error.message : "บันทึกไม่สำเร็จ",
        "error",
      );
    } finally {
      setSaving(false);
    }
  };

  const openProject = (project: ProjectRecord) => {
    const {
      id,
      category: _category,
      goodsValue: _goodsValue,
      internationalFreightCost: _internationalFreightCost,
      internationalFreightPerUnit: _internationalFreightPerUnit,
      domesticPackingCost: _domesticPackingCost,
      domesticPackingPerUnit: _domesticPackingPerUnit,
      cifValue: _cifValue,
      importDuty: _importDuty,
      importVat: _importVat,
      totalCost: _totalCost,
      costPerUnit: _costPerUnit,
      sellingPricePerUnit: _sellingPricePerUnit,
      profitPerUnit: _profitPerUnit,
      totalProfit: _totalProfit,
      formulaVersion: _formulaVersion,
      createdAt: _createdAt,
      updatedAt: _updatedAt,
      ...input
    } = project;
    setEditingId(id);
    setProductImagePreview("");
    setVolumeTiers(input.volumeTiers);
    setForm(input);
    setTab("calculator");
    window.scrollTo({ top: 0, behavior: "smooth" });
  };

  useEffect(() => {
    if (loading || !activeSharedProjectId) return;
    if (appliedSharedProjectId.current === activeSharedProjectId) return;

    const sharedProject = projects.find(
      (project) => project.id === activeSharedProjectId,
    );
    if (!sharedProject) {
      appliedSharedProjectId.current = activeSharedProjectId;
      showToast("ไม่พบโปรเจกต์จากลิงก์ที่แชร์", "error");
      return;
    }

    openProject(sharedProject);
    appliedSharedProjectId.current = activeSharedProjectId;
  }, [activeSharedProjectId, loading, openProject, projects, showToast]);

  const buildShareLink = (projectId: string) => {
    const url = new URL(window.location.href);
    url.search = "";
    url.searchParams.set("projectId", projectId);
    return url.toString();
  };

  const shareProject = async (projectId: string) => {
    const shareUrl = buildShareLink(projectId);
    try {
      await navigator.clipboard.writeText(shareUrl);
      showToast("คัดลอกลิงก์แชร์แล้ว");
    } catch {
      window.prompt("คัดลอกลิงก์นี้", shareUrl);
      showToast("คัดลอกลิงก์ไม่สำเร็จ", "error");
    }
  };

  const editProject = (project: ProjectRecord) => {
    openProject(project);
  };

  const duplicateProject = async (id: string) => {
    try {
      const duplicated = await jsonRequest<ProjectRecord>(
        `/api/projects/${id}/duplicate`,
        { method: "POST" },
      );
      setProjects((current) => [duplicated, ...current]);
      showToast("คัดลอกโปรเจกต์แล้ว");
    } catch (error) {
      showToast(
        error instanceof Error ? error.message : "คัดลอกไม่สำเร็จ",
        "error",
      );
    }
  };

  const downloadReportImage = async () => {
    if (!result) {
      showToast("ยังไม่มีข้อมูลสำหรับสร้างรูปภาพ", "error");
      return;
    }

    const title = form.productName.trim() || "สรุปราคาสินค้านำเข้า";
    const subtitle = [
      selectedCategory || "ไม่ระบุหมวด",
      modeLabel(form.mode),
      form.projectDate,
    ]
      .filter(Boolean)
      .join(" • ");
    const stats = [
      { label: "ต้นทุนรวม", value: baht.format(result.totalCost) },
      { label: "ต้นทุน / ชิ้น", value: baht.format(result.costPerUnit) },
      { label: "ราคาขายแนะนำ", value: baht.format(result.sellingPricePerUnit) },
      { label: "กำไรรวม", value: baht.format(result.totalProfit) },
    ];
    const costs: Array<{
      label: string;
      value: string;
      percent: string;
    }> = [
      {
        label: "ค่าขนส่งต่างประเทศ /EA",
        value: baht.format(result.internationalFreightPerUnit),
        percent: `${number.format(
          (result.internationalFreightCost / result.totalCost) * 100,
        )}%`,
      },
      {
        label: "แพ็กและขนส่งในประเทศ /EA",
        value: baht.format(result.domesticPackingPerUnit),
        percent: `${number.format(
          (result.domesticPackingCost / result.totalCost) * 100,
        )}%`,
      },
      {
        label: "ค่าขนส่งต่างประเทศรวม",
        value: baht.format(result.internationalFreightCost),
        percent: `${number.format(
          (result.internationalFreightCost / result.totalCost) * 100,
        )}%`,
      },
      {
        label: "แพ็กและขนส่งในประเทศรวม",
        value: baht.format(result.domesticPackingCost),
        percent: `${number.format(
          (result.domesticPackingCost / result.totalCost) * 100,
        )}%`,
      },
    ];
    const advanced: Array<{
      label: string;
      value: string;
      percent: string;
    }> = [
      {
        label: "CIF",
        value: baht.format(result.cifValue),
        percent: `${number.format((result.cifValue / result.totalCost) * 100)}%`,
      },
      {
        label: "อากรขาเข้า",
        value: baht.format(result.importDuty),
        percent: `${number.format((result.importDuty / result.totalCost) * 100)}%`,
      },
      {
        label: "VAT นำเข้า",
        value: baht.format(result.importVat),
        percent: `${number.format((result.importVat / result.totalCost) * 100)}%`,
      },
    ];
    const rows: Array<{ label: string; value: string; percent?: string }> = [
      {
        label: "ราคา EXW / ชิ้น",
        value: `${imageCurrency.format(form.unitForeignPrice)} ${form.currencyCode}`,
      },
      { label: "อัตราแลกเปลี่ยน", value: `${imageCurrency.format(form.exchangeRate)} บาท` },
      { label: "จำนวน", value: `${imageCurrency.format(form.quantity)} ชิ้น` },
      {
        label: "GP Margin",
        value: `${imageCurrency.format(form.gpMarginPct)}%`,
      },
      ...costs,
    ...(form.mode === "ADVANCED"
        ? advanced
        : []),
  ];
    const detailRowGap = rows.length > 8 ? 32 : 42;
    const reportTitleFontSize = title.length > 52 ? 30 : title.length > 34 ? 34 : 38;
    const reportTitleMaxChars = reportTitleFontSize === 30 ? 42 : reportTitleFontSize === 34 ? 36 : 32;
    const reportTitleLines = wrapSvgText(title, reportTitleMaxChars, 2);
    const reportTitleLineHeight = reportTitleFontSize + 8;
    const reportTitleY = 304;
    const reportDetailY =
      reportTitleY + (reportTitleLines.length - 1) * reportTitleLineHeight + 46;
    const reportHeroY = reportDetailY + 28;
    const reportStatsY = reportHeroY + 152;
    const volumeSectionY = 870;
    const volumeRowHeight = 58;
    const volumeRowsY = volumeSectionY + 142;
    const reportHeight =
      volumeRowsY + volumeRows.length * volumeRowHeight + 112;

    const svg = `
      <svg xmlns="http://www.w3.org/2000/svg" width="1600" height="${reportHeight}" viewBox="0 0 1600 ${reportHeight}">
        <defs>
          <linearGradient id="bg" x1="0" y1="0" x2="1" y2="1">
            <stop offset="0%" stop-color="#f8fafc"/>
            <stop offset="52%" stop-color="#f2f5fb"/>
            <stop offset="100%" stop-color="#eaf0fb"/>
          </linearGradient>
          <linearGradient id="hero" x1="0" y1="0" x2="1" y2="1">
            <stop offset="0%" stop-color="#14213d"/>
            <stop offset="58%" stop-color="#1c3159"/>
            <stop offset="100%" stop-color="#244a77"/>
          </linearGradient>
          <linearGradient id="success" x1="0" y1="0" x2="1" y2="1">
            <stop offset="0%" stop-color="#eefaf4"/>
            <stop offset="100%" stop-color="#ddf4e9"/>
          </linearGradient>
          <radialGradient id="glow">
            <stop offset="0%" stop-color="#ff8a5c" stop-opacity="0.24"/>
            <stop offset="100%" stop-color="#ff8a5c" stop-opacity="0"/>
          </radialGradient>
          <filter id="shadow" x="-10%" y="-10%" width="120%" height="125%">
            <feDropShadow dx="0" dy="10" stdDeviation="16" flood-color="#17223b" flood-opacity="0.08"/>
          </filter>
          <style>
            .title { font: 700 44px 'Leelawadee UI', 'Segoe UI', sans-serif; fill: #17223b; }
            .subtitle { font: 500 20px 'Leelawadee UI', 'Segoe UI', sans-serif; fill: #68758e; }
            .card-title { font: 600 18px 'Leelawadee UI', 'Segoe UI', sans-serif; fill: #68758e; }
            .card-value { font: 800 42px 'Leelawadee UI', 'Segoe UI', sans-serif; fill: #17223b; }
            .small { font: 500 16px 'Leelawadee UI', 'Segoe UI', sans-serif; fill: #68758e; }
            .badge { font: 800 14px 'Segoe UI', sans-serif; fill: #ff6636; letter-spacing: 0.18em; }
            .section { font: 700 24px 'Leelawadee UI', 'Segoe UI', sans-serif; fill: #17223b; }
            .label { font: 600 16px 'Leelawadee UI', 'Segoe UI', sans-serif; fill: #68758e; }
            .value { font: 700 18px 'Leelawadee UI', 'Segoe UI', sans-serif; fill: #17223b; text-anchor: end; }
            .table-head { font: 700 15px 'Leelawadee UI', 'Segoe UI', sans-serif; fill: #526078; }
            .table-cell { font: 700 17px 'Leelawadee UI', 'Segoe UI', sans-serif; fill: #17223b; }
          </style>
        </defs>
        <rect width="1600" height="${reportHeight}" rx="32" fill="url(#bg)"/>
        <circle cx="1510" cy="50" r="260" fill="url(#glow)"/>
        <circle cx="60" cy="${reportHeight - 40}" r="220" fill="url(#glow)" opacity="0.45"/>
        <rect x="60" y="50" width="1480" height="110" rx="28" fill="#ffffff" filter="url(#shadow)"/>
        <rect x="88" y="78" width="54" height="54" rx="16" fill="#ff6636"/>
        <circle cx="132" cy="87" r="18" fill="#ffffff" opacity="0.13"/>
        <text x="115" y="113" text-anchor="middle" font-family="Segoe UI, sans-serif" font-size="34" font-weight="800" fill="#ffffff">฿</text>
        <text x="165" y="97" class="title" style="font-size:34px">Import Price Studio</text>
        <text x="165" y="127" class="subtitle" style="font-size:18px">เครื่องมือคำนวณราคานำเข้า</text>
        <rect x="1362" y="72" width="138" height="34" rx="17" fill="#fff1eb"/>
        <text x="1431" y="94" text-anchor="middle" class="badge" style="font-size:12px;letter-spacing:0.08em">PRICE REPORT</text>
        <text x="1500" y="122" text-anchor="end" class="subtitle" style="font-size:15px">
          ${escapeXml(wrapSvgText(subtitle, 38, 2)[0] ?? subtitle)}
        </text>
        <text x="1500" y="144" text-anchor="end" class="subtitle" style="font-size:13px">
          ${escapeXml(wrapSvgText(subtitle, 38, 2)[1] ?? "")}
        </text>

        <rect x="60" y="188" width="980" height="652" rx="30" fill="#ffffff" filter="url(#shadow)"/>
        <rect x="60" y="188" width="12" height="652" rx="6" fill="#ff6636"/>
        <text x="96" y="250" class="badge">REPORT SUMMARY</text>
        <text x="96" y="${reportTitleY}" class="title" style="font-size:${reportTitleFontSize}px">
          ${reportTitleLines
            .map((line, index) => `<tspan x="96" dy="${index === 0 ? 0 : reportTitleLineHeight}">${escapeXml(line)}</tspan>`)
            .join("")}
        </text>
        <text x="96" y="${reportDetailY}" class="subtitle" style="font-size:15px">
          ${escapeXml(
            (form.detail || "สรุปราคาสินค้าพร้อมต้นทุนและกำไร").trim().slice(0, 96),
          )}
          ${form.detail && form.detail.trim().length > 96 ? "…" : ""}
        </text>

        <rect x="96" y="${reportHeroY}" width="908" height="120" rx="24" fill="url(#hero)"/>
        <circle cx="944" cy="${reportHeroY + 12}" r="108" fill="#ffffff" opacity="0.04"/>
        <circle cx="890" cy="${reportHeroY + 104}" r="74" fill="#ff8a5c" opacity="0.1"/>
        <rect x="96" y="${reportHeroY}" width="8" height="120" rx="4" fill="#ff6636"/>
        <text x="132" y="${reportHeroY + 47}" class="small" style="fill:#bdc8dc">ราคาขายแนะนำ / ชิ้น</text>
        <text x="132" y="${reportHeroY + 101}" style="font: 800 56px 'Leelawadee UI', 'Segoe UI', sans-serif; fill: #ffffff;">${escapeXml(baht.format(result.sellingPricePerUnit))}</text>
        <rect x="842" y="${reportHeroY + 36}" width="126" height="46" rx="23" fill="#ffffff" opacity="0.12"/>
        <text x="905" y="${reportHeroY + 65}" text-anchor="middle" style="font:700 17px 'Leelawadee UI','Segoe UI',sans-serif;fill:#ffffff">GP ${imageCurrency.format(form.gpMarginPct)}%</text>

        ${stats
          .map((item, index) => {
            const x = 96 + (index % 2) * 446;
            const y = reportStatsY + Math.floor(index / 2) * 112;
            const accent = ["#ff6636", "#3b82f6", "#17223b", "#079669"][index];
            return `
              <rect x="${x}" y="${y}" width="418" height="94" rx="20" fill="#f8fafc" stroke="#e1e7f0"/>
              <rect x="${x}" y="${y + 18}" width="5" height="58" rx="2.5" fill="${accent}"/>
              <text x="${x + 26}" y="${y + 33}" class="card-title">${escapeXml(item.label)}</text>
              <text x="${x + 26}" y="${y + 74}" class="card-value" style="font-size:31px">${escapeXml(item.value)}</text>
            `;
          })
          .join("")}

        <rect x="1080" y="188" width="460" height="652" rx="30" fill="#ffffff" filter="url(#shadow)"/>
        <rect x="1114" y="222" width="38" height="38" rx="12" fill="#eef3fb"/>
        <text x="1133" y="248" text-anchor="middle" style="font:800 19px 'Segoe UI',sans-serif;fill:#244a77">฿</text>
        <text x="1168" y="250" class="section">รายละเอียดต้นทุน</text>

        ${rows
          .map((item, index) => {
            const y = 292 + index * detailRowGap;
            return `
              ${index > 0 ? `<line x1="1114" y1="${y - detailRowGap / 2}" x2="1506" y2="${y - detailRowGap / 2}" stroke="#edf0f5"/>` : ""}
              <text x="1114" y="${y}" class="label">${escapeXml(
                wrapSvgText(item.label, 34, 1)[0] ?? item.label,
              )}</text>
              <text x="1504" y="${y}" class="value">
                ${escapeXml(item.value)}
                ${item.percent ? ` <tspan class="small">${escapeXml(item.percent)}</tspan>` : ""}
              </text>
            `;
          })
          .join("")}

        <rect x="1114" y="670" width="392" height="120" rx="22" fill="url(#success)" stroke="#bde6d1"/>
        <circle cx="1464" cy="708" r="48" fill="#079669" opacity="0.07"/>
        <text x="1140" y="706" class="label" style="fill:#34745b">ต้นทุนรวม</text>
        <text x="1140" y="758" style="font: 800 40px 'Leelawadee UI', 'Segoe UI', sans-serif; fill:#07865e">${escapeXml(baht.format(result.totalCost))}</text>

        <text x="1114" y="817" class="small" style="font-size:13px">ประมาณการเพื่อประกอบการตัดสินใจ ไม่ใช่เอกสารศุลกากร</text>

        <rect x="60" y="${volumeSectionY}" width="1480" height="${reportHeight - volumeSectionY - 36}" rx="30" fill="#ffffff" filter="url(#shadow)"/>
        <rect x="60" y="${volumeSectionY}" width="12" height="${reportHeight - volumeSectionY - 36}" rx="6" fill="#ff6636"/>
        <text x="96" y="${volumeSectionY + 52}" class="badge">VOLUME PRICING</text>
        <text x="96" y="${volumeSectionY + 86}" class="section">ราคาขั้นบันไดตามปริมาณ</text>
        <rect x="1398" y="${volumeSectionY + 42}" width="106" height="36" rx="18" fill="#fff1eb"/>
        <text x="1451" y="${volumeSectionY + 65}" text-anchor="middle" style="font:700 14px 'Leelawadee UI','Segoe UI',sans-serif;fill:#e75425">${volumeRows.length} ระดับราคา</text>

        <rect x="96" y="${volumeSectionY + 106}" width="1408" height="50" rx="14" fill="#172744"/>
        <text x="120" y="${volumeSectionY + 138}" class="table-head" style="fill:#ffffff">ช่วงจำนวน (ชิ้น)</text>
        <text x="590" y="${volumeSectionY + 138}" text-anchor="end" class="table-head" style="fill:#ffffff">จำนวน</text>
        <text x="694" y="${volumeSectionY + 138}" text-anchor="middle" class="table-head" style="fill:#ffffff">ลด (%)</text>
        <text x="970" y="${volumeSectionY + 138}" text-anchor="end" class="table-head" style="fill:#ffffff">ราคาต่อหน่วย</text>
        <text x="1170" y="${volumeSectionY + 138}" text-anchor="end" class="table-head" style="fill:#ffffff">กำไร / หน่วย</text>
        <text x="1380" y="${volumeSectionY + 138}" text-anchor="end" class="table-head" style="fill:#ffffff">MARGIN รวม</text>
        <text x="1450" y="${volumeSectionY + 138}" text-anchor="middle" class="table-head" style="fill:#ffffff">MARGIN %</text>

        ${volumeRows
          .map((tier, index) => {
            const rowY = volumeRowsY + index * volumeRowHeight;
            const textY = rowY + 36;
            return `
              <rect x="96" y="${rowY}" width="1408" height="${volumeRowHeight}" fill="${index % 2 === 0 ? "#ffffff" : "#f8fafc"}"/>
              <line x1="96" y1="${rowY + volumeRowHeight}" x2="1504" y2="${rowY + volumeRowHeight}" stroke="#e5eaf1"/>
              <text x="120" y="${textY}" class="table-cell">${escapeXml(tier.qty)}</text>
              <text x="590" y="${textY}" text-anchor="end" class="table-cell">${escapeXml(number.format(tier.quantity))}</text>
              <rect x="656" y="${rowY + 14}" width="76" height="30" rx="15" fill="${tier.discount > 0 ? "#fff1eb" : "#eef2f7"}"/>
              <text x="694" y="${rowY + 35}" text-anchor="middle" style="font:700 15px 'Segoe UI',sans-serif;fill:${tier.discount > 0 ? "#e75425" : "#68758e"}">${escapeXml(number.format(tier.discount))}%</text>
              <text x="970" y="${textY}" text-anchor="end" class="table-cell">${escapeXml(baht.format(tier.price))}</text>
              <text x="1170" y="${textY}" text-anchor="end" class="table-cell" style="fill:${tier.profit >= 0 ? "#079669" : "#dc3545"}">${escapeXml(baht.format(tier.profit))}</text>
              <text x="1380" y="${textY}" text-anchor="end" class="table-cell">${escapeXml(tier.totalMargin === null ? "—" : baht.format(tier.totalMargin))}</text>
              <rect x="1412" y="${rowY + 14}" width="76" height="30" rx="15" fill="${tier.margin >= 20 ? "#e5f7ef" : "#eef2f7"}"/>
              <text x="1450" y="${rowY + 35}" text-anchor="middle" style="font:700 14px 'Segoe UI',sans-serif;fill:${tier.margin >= 20 ? "#07865e" : "#526078"}">${escapeXml(formatPercent(tier.margin))}</text>
            `;
          })
          .join("")}

        <line x1="96" y1="${reportHeight - 78}" x2="1504" y2="${reportHeight - 78}" stroke="#e5eaf1"/>
        <text x="96" y="${reportHeight - 46}" class="small" style="font-size:14px">ราคาแต่ละระดับคำนวณจากราคาขายแนะนำ หักส่วนลดตามปริมาณ</text>
        <text x="1504" y="${reportHeight - 46}" text-anchor="end" class="small" style="font-size:14px">Import Price Studio • ${escapeXml(form.projectDate)}</text>
      </svg>
    `.trim();

    const blob = new Blob([svg], { type: "image/svg+xml;charset=utf-8" });
    const objectUrl = URL.createObjectURL(blob);
    try {
      const image = new Image();
      image.decoding = "async";
      image.crossOrigin = "anonymous";
      const loaded = new Promise<void>((resolve, reject) => {
        image.onload = () => resolve();
        image.onerror = () => reject(new Error("สร้างภาพไม่สำเร็จ"));
      });
      image.src = objectUrl;
      await loaded;

      const canvas = document.createElement("canvas");
      canvas.width = 1600;
      canvas.height = reportHeight;
      const context = canvas.getContext("2d");
      if (!context) {
        throw new Error("ไม่สามารถเข้าถึง canvas ได้");
      }
      context.drawImage(image, 0, 0);

      const downloadLink = document.createElement("a");
      downloadLink.download = `${(form.productName || "import-price-report").trim().replace(/[\\/:*?"<>|]+/g, "-")}.png`;
      downloadLink.href = canvas.toDataURL("image/png");
      downloadLink.click();
      showToast("ดาวน์โหลดรูปภาพรายงานแล้ว");
    } catch (error) {
      showToast(
        error instanceof Error ? error.message : "สร้างรูปภาพไม่สำเร็จ",
        "error",
      );
    } finally {
      URL.revokeObjectURL(objectUrl);
    }
  };

  const deleteProject = async (id: string) => {
    if (!window.confirm("ลบโปรเจกต์นี้ใช่หรือไม่?")) return;
    try {
      await jsonRequest(`/api/projects/${id}`, { method: "DELETE" });
      setProjects((current) => current.filter((item) => item.id !== id));
      if (editingId === id) resetForm();
      showToast("ลบโปรเจกต์แล้ว");
    } catch (error) {
      showToast(
        error instanceof Error ? error.message : "ลบไม่สำเร็จ",
        "error",
      );
    }
  };

  const addCategory = async () => {
    if (!newCategoryName.trim()) return;
    try {
      const category = await jsonRequest<CategoryRecord>("/api/categories", {
        method: "POST",
        body: JSON.stringify({ name: newCategoryName }),
      });
      setCategories((current) => [...current, category]);
      setCategoryDrafts((current) => ({
        ...current,
        [category.id]: category.name,
      }));
      setNewCategoryName("");
      showToast("เพิ่มหมวดสินค้าแล้ว");
    } catch (error) {
      showToast(
        error instanceof Error ? error.message : "เพิ่มหมวดไม่สำเร็จ",
        "error",
      );
    }
  };

  const updateCategory = async (
    id: string,
    patch: { name?: string; isActive?: boolean },
  ) => {
    try {
      const category = await jsonRequest<CategoryRecord>(
        `/api/categories/${id}`,
        { method: "PATCH", body: JSON.stringify(patch) },
      );
      setCategories((current) =>
        current.map((item) => (item.id === id ? category : item)),
      );
      setCategoryDrafts((current) => ({
        ...current,
        [category.id]: category.name,
      }));
      showToast("อัปเดตหมวดสินค้าแล้ว");
    } catch (error) {
      showToast(
        error instanceof Error ? error.message : "แก้ไขหมวดไม่สำเร็จ",
        "error",
      );
    }
  };

  const deleteCategory = async (id: string) => {
    if (!window.confirm("ลบหมวดสินค้านี้ใช่หรือไม่?")) return;
    try {
      await jsonRequest(`/api/categories/${id}`, { method: "DELETE" });
      setCategories((current) => current.filter((item) => item.id !== id));
      if (form.categoryId === id) {
        setForm((current) => ({ ...current, categoryId: null }));
      }
      showToast("ลบหมวดสินค้าแล้ว");
    } catch (error) {
      showToast(
        error instanceof Error ? error.message : "ลบหมวดไม่สำเร็จ",
        "error",
      );
    }
  };

  const backup = () => {
    window.location.href = "/api/backup/export";
  };

  const restore = async (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;
    if (
      restoreMode === "replace" &&
      !window.confirm(
        "การกู้คืนแบบแทนที่จะลบข้อมูลปัจจุบันทั้งหมดก่อน ดำเนินการต่อหรือไม่?",
      )
    ) {
      event.target.value = "";
      return;
    }
    try {
      const backupPayload = JSON.parse(await file.text());
      await jsonRequest("/api/backup/import", {
        method: "POST",
        body: JSON.stringify({ mode: restoreMode, backup: backupPayload }),
      });
      await loadData();
      resetForm();
      showToast("กู้คืนข้อมูลเรียบร้อย");
    } catch (error) {
      showToast(
        error instanceof Error ? error.message : "ไฟล์สำรองไม่ถูกต้อง",
        "error",
      );
    } finally {
      event.target.value = "";
    }
  };

  const selectedCategory =
    categories.find((category) => category.id === form.categoryId)?.name ?? "-";

  return (
    <main className="app-shell">
      <Toast message={toast.message} kind={toast.kind} />
      <header className="topbar no-print">
        <div className="brand">
          <span className="brand-mark small-mark" aria-hidden="true">
            ฿
          </span>
          <div>
            <strong>Import Price Studio</strong>
            <span>เครื่องมือคำนวณราคานำเข้า</span>
          </div>
        </div>
        <div className="account">
          <span className="account-copy">
            <strong>{user.name ?? "Nart"}</strong>
            <small>{user.email}</small>
          </span>
          {firebaseConfig ? (
            <button
              className="icon-button"
              onClick={() => void logoutUser()}
              type="button"
              title="ออกจากระบบ"
            >
              ↗
            </button>
          ) : (
            <form action={logout}>
            <button className="icon-button" type="submit" title="ออกจากระบบ">
              ↗
            </button>
            </form>
          )}
        </div>
      </header>

      <nav className="tabs no-print" aria-label="เมนูหลัก">
        <button
          className={tab === "calculator" ? "active" : ""}
          onClick={() => setTab("calculator")}
        >
          <span>⌁</span> คำนวณราคา
        </button>
        <button
          className={tab === "projects" ? "active" : ""}
          onClick={() => setTab("projects")}
        >
          <span>▤</span> โปรเจกต์
          <em>{projects.length}</em>
        </button>
        <button
          className={tab === "categories" ? "active" : ""}
          onClick={() => setTab("categories")}
        >
          <span>◫</span> หมวดสินค้า
        </button>
      </nav>

      {loading ? (
        <div className="loading-panel">
          <span className="spinner" />
          กำลังเตรียมข้อมูล…
        </div>
      ) : null}

      {!loading && tab === "calculator" ? (
        <div className="workspace">
          <section className="hero no-print">
            <div>
              <p className="eyebrow">PRICING WORKSPACE</p>
              <h1>{editingId ? "แก้ไขโปรเจกต์ราคา" : "คำนวณราคาขายอย่างมั่นใจ"}</h1>
              <p>
                ใส่ต้นทุนจริง เลือกเป้ากำไร แล้วดูราคาขายแนะนำได้ทันที
              </p>
            </div>
            <button className="button secondary" onClick={resetForm}>
              ＋ โปรเจกต์ใหม่
            </button>
          </section>

          <div className="workspace-top-row no-print">
            <section className="mode-switch" aria-label="โหมดคำนวณ">
              <button
                className={form.mode === "SIMPLE" ? "active" : ""}
                onClick={() =>
                  setForm((current) => ({ ...current, mode: "SIMPLE" }))
                }
              >
                <strong>โหมดง่าย</strong>
                <span>คำนวณด้วยเปอร์เซ็นต์</span>
              </button>
              <button
                className={form.mode === "ADVANCED" ? "active" : ""}
                onClick={() =>
                  setForm((current) => ({ ...current, mode: "ADVANCED" }))
                }
              >
                <strong>โหมดละเอียด</strong>
                <span>อากร VAT และค่าใช้จ่ายจริง</span>
              </button>
            </section>

            <section className="share-strip" aria-label="แชร์โปรเจกต์">
              <div>
                <p className="eyebrow">SHARE LINK</p>
                <h3>แชร์ลิงก์โปรเจกต์นี้</h3>
                <p>กดเพื่อคัดลอกลิงก์เปิดดูโปรเจกต์นี้โดยตรง</p>
              </div>
              <div className="share-preview">
                {displayedProductImage ? (
                  <img
                    alt={form.productName || "รูปภาพสินค้า"}
                    src={displayedProductImage}
                  />
                ) : (
                  <div className="share-preview-empty">
                    <strong>ยังไม่มีรูปสินค้า</strong>
                    <span>อัปโหลดรูปภาพในข้อมูลสินค้า</span>
                  </div>
                )}
              </div>
              <button
                className="button ghost share-button"
                disabled={!editingId}
                onClick={() => {
                  if (editingId) void shareProject(editingId);
                }}
              >
                แชร์ลิงก์
              </button>
            </section>
          </div>

          <div className="editor-layout no-print">
            <div className="form-column">
              <section className="panel">
                <SectionTitle
                  index="01"
                  title="ข้อมูลสินค้า"
                  description="ระบุชื่อและจัดหมวดเพื่อค้นหาภายหลัง"
                />
                <div className="form-grid two">
                  <label className="field">
                    <span className="field-label">วันที่โปรเจกต์</span>
                    <input
                      type="date"
                      value={form.projectDate}
                      onChange={(event) =>
                        setForm((current) => ({
                          ...current,
                          projectDate: event.target.value,
                        }))
                      }
                    />
                  </label>
                  <label className="field">
                    <span className="field-label">หมวดสินค้า</span>
                    <select
                      value={form.categoryId ?? ""}
                      onChange={(event) =>
                        setForm((current) => ({
                          ...current,
                          categoryId: event.target.value || null,
                        }))
                      }
                    >
                      <option value="">ไม่ระบุหมวด</option>
                      {categories
                        .filter(
                          (category) =>
                            category.isActive || category.id === form.categoryId,
                        )
                        .map((category) => (
                          <option key={category.id} value={category.id}>
                            {category.name}
                            {!category.isActive ? " (ปิดใช้งาน)" : ""}
                          </option>
                        ))}
                    </select>
                  </label>
                </div>
                <label className="field">
                  <span className="field-label">ชื่อสินค้า *</span>
                  <input
                    maxLength={200}
                    placeholder="เช่น PET Strap 16 mm"
                    value={form.productName}
                    onChange={(event) =>
                      setForm((current) => ({
                        ...current,
                        productName: event.target.value,
                      }))
                    }
                  />
                </label>
                <label className="field">
                  <span className="field-label">รายละเอียด</span>
                  <textarea
                    maxLength={2000}
                    placeholder="รุ่น สี ขนาด เงื่อนไข หรือข้อมูลที่ต้องจำ"
                    rows={3}
                    value={form.detail}
                    onChange={(event) =>
                      setForm((current) => ({
                        ...current,
                        detail: event.target.value,
                      }))
                    }
                  />
                </label>
                <div className="field product-image-field">
                  <span className="field-label">รูปภาพสินค้า</span>
                  <div
                    className={`product-image-upload ${
                      displayedProductImage ? "has-image" : ""
                    }`}
                  >
                    {displayedProductImage ? (
                      <img
                        alt={form.productName || "ตัวอย่างรูปภาพสินค้า"}
                        src={displayedProductImage}
                      />
                    ) : (
                      <div className="product-image-empty">
                        <span aria-hidden="true">▧</span>
                        <strong>เลือกรูปภาพสินค้า</strong>
                        <small>JPG, PNG, WebP หรือ GIF ขนาดไม่เกิน 5 MB</small>
                      </div>
                    )}
                    {uploadingImage ? (
                      <div className="product-image-uploading">
                        <span /> กำลังอัปโหลดรูปภาพ…
                      </div>
                    ) : null}
                  </div>
                  <input
                    ref={productImageInput}
                    accept="image/jpeg,image/png,image/webp,image/gif"
                    className="product-image-input"
                    disabled={uploadingImage}
                    onChange={(event) => void uploadProductImage(event)}
                    type="file"
                  />
                  <div className="image-actions">
                    <button
                      className="button ghost small-button image-upload-button"
                      disabled={uploadingImage}
                      onClick={() => productImageInput.current?.click()}
                      type="button"
                    >
                      {displayedProductImage ? "เปลี่ยนรูป" : "เลือกรูปภาพ"}
                    </button>
                    <button
                      className="button ghost small-button"
                      disabled={!displayedProductImage || uploadingImage}
                      onClick={clearProductImage}
                      type="button"
                    >
                      ลบรูป
                    </button>
                  </div>
                </div>
              </section>

              <section className="panel">
                <SectionTitle
                  index="02"
                  title="ราคาสินค้า"
                  description="ค่าเริ่มต้นเป็นเงินหยวน (CNY)"
                />
                <div className="form-grid three">
                  <Field
                    label="ราคา EXW / ชิ้น"
                    suffix="CNY"
                    value={form.unitForeignPrice}
                    onChange={(value) => setNumber("unitForeignPrice", value)}
                  />
                  <Field
                    label="อัตราแลกเปลี่ยน"
                    suffix="฿"
                    value={form.exchangeRate}
                    onChange={(value) => setNumber("exchangeRate", value)}
                  />
                  <Field
                    label="จำนวน"
                    suffix="ชิ้น"
                    min={0.0001}
                    value={form.quantity}
                    onChange={(value) => setNumber("quantity", value)}
                  />
                </div>
                <div className="formula-preview">
                  <span>มูลค่าสินค้าเงินบาท</span>
                  <strong>{result ? baht.format(result.goodsValue) : "—"}</strong>
                  <small>
                    {number.format(form.unitForeignPrice)} ×{" "}
                    {number.format(form.exchangeRate)} ×{" "}
                    {number.format(form.quantity)}
                  </small>
                </div>
              </section>

                  {form.mode === "SIMPLE" ? (
                <section className="panel">
                  <SectionTitle
                    index="03"
                    title="ค่าใช้จ่ายแบบเปอร์เซ็นต์"
                    description="สูตรเดียวกับเว็บตัวอย่าง"
                  />
                  <div className="form-grid two">
                    <Field
                      label="ค่าขนส่งต่างประเทศ"
                      suffix="%"
                      value={form.overseasShippingPct}
                      onChange={(value) =>
                        setNumber("overseasShippingPct", value)
                      }
                    />
                    <Field
                      label="แพ็กและขนส่งในประเทศ"
                      suffix="%"
                      value={form.domesticPackingPct}
                      onChange={(value) =>
                        setNumber("domesticPackingPct", value)
                      }
                    />
                  </div>
                </section>
              ) : (
                <section className="panel">
                  <SectionTitle
                    index="03"
                    title="ต้นทุนนำเข้าแบบละเอียด"
                    description="ใช้ราคา CIF เป็นฐานคำนวณอากร"
                  />
                  <div className="form-grid two">
                    <Field
                      label="ค่าระวางต่างประเทศ"
                      suffix="฿"
                      value={form.internationalFreight}
                      onChange={(value) =>
                        setNumber("internationalFreight", value)
                      }
                    />
                    <Field
                      label="ค่าประกันภัย"
                      suffix="฿"
                      value={form.insurance}
                      onChange={(value) => setNumber("insurance", value)}
                    />
                    <Field
                      label="อัตราอากรขาเข้า"
                      suffix="%"
                      value={form.dutyRatePct}
                      onChange={(value) => setNumber("dutyRatePct", value)}
                    />
                    <Field
                      label="ภาษี/ค่าธรรมเนียมอื่นในฐาน VAT"
                      suffix="฿"
                      value={form.otherTaxFees}
                      onChange={(value) => setNumber("otherTaxFees", value)}
                    />
                    <Field
                      label="ค่าชิปปิ้ง/พิธีการ"
                      suffix="฿"
                      value={form.brokerFee}
                      onChange={(value) => setNumber("brokerFee", value)}
                    />
                    <Field
                      label="ขนส่งในประเทศ"
                      suffix="฿"
                      value={form.domesticLogistics}
                      onChange={(value) =>
                        setNumber("domesticLogistics", value)
                      }
                    />
                    <Field
                      label="ค่าใช้จ่ายอื่น"
                      suffix="฿"
                      value={form.otherExpenses}
                      onChange={(value) => setNumber("otherExpenses", value)}
                    />
                    <Field
                      label="VAT นำเข้า"
                      suffix="%"
                      value={form.vatRatePct}
                      onChange={(value) => setNumber("vatRatePct", value)}
                    />
                  </div>
                  <label className="toggle-row">
                    <span>
                      <strong>รวม VAT เป็นต้นทุน</strong>
                      <small>
                        ปิดได้เมื่อกิจการนำ VAT นำเข้าไปเครดิตภาษีซื้อ
                      </small>
                    </span>
                    <input
                      checked={form.includeVatInCost}
                      onChange={(event) =>
                        setForm((current) => ({
                          ...current,
                          includeVatInCost: event.target.checked,
                        }))
                      }
                      type="checkbox"
                    />
                  </label>
                </section>
              )}

              <section className="panel">
                <SectionTitle
                  index="04"
                  title="เป้าหมายกำไร"
                  description="GP Margin ต้องต่ำกว่า 100%"
                />
                <Field
                  label="GP Margin ที่ต้องการ"
                  suffix="%"
                  value={form.gpMarginPct}
                  onChange={(value) => setNumber("gpMarginPct", value)}
                />
                <div className="margin-scale" aria-hidden="true">
                  <span style={{ width: `${Math.min(form.gpMarginPct, 99)}%` }} />
                </div>
              </section>

              {form.mode === "SIMPLE" ||
              form.mode === "ADVANCED" ||
              form.mode === "VOLUME" ? (
                <section className="volume-panel">
                  <div className="volume-panel-head">
                    <div>
                      <p className="eyebrow">Volume Pricing</p>
                      <h3>ราคาขั้นบันไดตามปริมาณ</h3>
                      <p>อิงจากราคาขายแนะนำ แล้วลดตามระดับปริมาณ</p>
                    </div>
                    <button
                      className="button ghost volume-add"
                      onClick={addVolumeTier}
                      type="button"
                    >
                      ＋ เพิ่มระดับจำนวน
                    </button>
                  </div>
                  <div className="volume-table-wrap">
                    <table className="volume-table">
                      <colgroup>
                        <col className="volume-col-range" />
                        <col className="volume-col-quantity" />
                        <col className="volume-col-discount" />
                        <col className="volume-col-unit" />
                        <col className="volume-col-profit" />
                        <col className="volume-col-total" />
                        <col className="volume-col-margin" />
                        <col className="volume-col-action" />
                      </colgroup>
                      <thead>
                        <tr>
                          <th>ช่วงจำนวน (ชิ้น)</th>
                          <th className="right">จำนวน</th>
                          <th>ลด (%)</th>
                          <th className="right">ราคาต่อหน่วย</th>
                          <th className="right">กำไรสุทธิ</th>
                          <th className="right">margin รวม</th>
                          <th className="right">MARGIN %</th>
                          <th />
                        </tr>
                      </thead>
                      <tbody>
                        {volumeRows.map((tier, index) => (
                          <tr key={`${tier.qty}-${index}`}>
                            <td>
                              <input
                                value={tier.qty}
                                onChange={(event) =>
                                  setVolumeTier(index, "qty", event.target.value)
                                }
                                type="text"
                              />
                            </td>
                            <td className="right strong">
                              <input
                                className="center volume-number-input"
                                min={0}
                                inputMode="numeric"
                                pattern="[0-9]*"
                                step={1}
                                value={tier.quantity}
                                onChange={(event) =>
                                  setVolumeTier(
                                    index,
                                    "quantity",
                                    event.target.value === ""
                                      ? ""
                                      : Number(event.target.value),
                                  )
                                }
                                type="number"
                              />
                            </td>
                            <td>
                              <input
                                className="center volume-number-input"
                                min={0}
                                max={100}
                                inputMode="decimal"
                                pattern="[0-9]*[.,]?[0-9]*"
                                step={0.1}
                                value={tier.discount}
                                onChange={(event) =>
                                  setVolumeTier(
                                    index,
                                    "discount",
                                    event.target.value === ""
                                      ? ""
                                      : Number(event.target.value),
                                  )
                                }
                                type="number"
                              />
                            </td>
                            <td className="right strong">
                              {result ? baht.format(tier.price) : "—"}
                            </td>
                            <td
                              className={`right ${
                                tier.profit >= 0 ? "positive" : "negative"
                              }`}
                            >
                              {result ? baht.format(tier.profit) : "—"}
                            </td>
                            <td className="right strong">
                              {result && tier.totalMargin !== null
                                ? baht.format(tier.totalMargin)
                                : "—"}
                            </td>
                            <td className="right strong">
                              {result ? formatPercent(tier.margin) : "—"}
                            </td>
                            <td className="right no-export">
                              <button
                                type="button"
                                className="volume-remove"
                                onClick={() => removeVolumeTier(index)}
                                title="ลบระดับ"
                              >
                                ×
                              </button>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </section>
              ) : null}
            </div>

            <aside className="summary-column">
              <div className="summary-card">
                <p className="eyebrow">ผลคำนวณแบบเรียลไทม์</p>
                <MetricCard
                  label="ราคาขายแนะนำ / ชิ้น"
                  value={result ? baht.format(result.sellingPricePerUnit) : "—"}
                  tone="accent"
                  note={`GP ${number.format(form.gpMarginPct)}%`}
                />
                <div className="metric-grid">
                  <MetricCard
                    label="ต้นทุนรวม"
                    value={result ? baht.format(result.totalCost) : "—"}
                  />
                  <MetricCard
                    label="ต้นทุน / ชิ้น"
                    value={result ? baht.format(result.costPerUnit) : "—"}
                  />
                  <MetricCard
                    label="กำไร / ชิ้น"
                    value={result ? baht.format(result.profitPerUnit) : "—"}
                    tone="profit"
                  />
                  <MetricCard
                    label="กำไรรวม"
                    value={result ? baht.format(result.totalProfit) : "—"}
                    tone="profit"
                  />
                </div>
                <dl className="transport-breakdown">
                  <div>
                    <dt>ค่าขนส่งต่างประเทศ /EA</dt>
                    <dd>
                      {result
                        ? baht.format(result.internationalFreightPerUnit)
                        : "—"}
                    </dd>
                  </div>
                  <div>
                    <dt>แพ็กและขนส่งในประเทศ /EA</dt>
                    <dd>
                      {result ? baht.format(result.domesticPackingPerUnit) : "—"}
                    </dd>
                  </div>
                  <div>
                    <dt>ค่าขนส่งต่างประเทศรวม</dt>
                    <dd>
                      {result
                        ? baht.format(result.internationalFreightCost)
                        : "—"}
                    </dd>
                  </div>
                  <div>
                    <dt>แพ็กและขนส่งในประเทศรวม</dt>
                    <dd>
                      {result ? baht.format(result.domesticPackingCost) : "—"}
                    </dd>
                  </div>
                </dl>
                {form.mode === "ADVANCED" && result ? (
                  <dl className="cost-breakdown">
                    <div>
                      <dt>มูลค่า CIF</dt>
                      <dd>{baht.format(result.cifValue)}</dd>
                    </div>
                    <div>
                      <dt>อากรขาเข้า</dt>
                      <dd>{baht.format(result.importDuty)}</dd>
                    </div>
                    <div>
                      <dt>VAT นำเข้า</dt>
                      <dd>{baht.format(result.importVat)}</dd>
                    </div>
                  </dl>
                ) : null}
                <div className="summary-actions">
                  <button
                    className="button primary"
                    disabled={saving || uploadingImage}
                    onClick={saveProject}
                  >
                    {uploadingImage
                      ? "กำลังอัปโหลดรูป…"
                      : saving
                        ? "กำลังบันทึก…"
                        : editingId
                          ? "บันทึกการแก้ไข"
                          : "บันทึกโปรเจกต์"}
                  </button>
                  <button
                    className="button ghost"
                    onClick={() => window.print()}
                  >
                    พิมพ์ / PDF
                  </button>
                  <button
                    className="button ghost"
                    onClick={() => void downloadReportImage()}
                  >
                    รูปภาพ
                  </button>
                </div>
                <p className="disclaimer">
                  ผลลัพธ์เป็นประมาณการต้นทุน ไม่ใช่เอกสารยื่นศุลกากร
                </p>
              </div>
            </aside>
          </div>

          <section id="print-report" className="print-report">
            <header className="print-report-header">
              <div className="print-brand">
                <span className="print-brand-mark">฿</span>
                <div>
                  <strong>Import Price Studio</strong>
                  <small>เครื่องมือคำนวณราคานำเข้า</small>
                </div>
              </div>
              <div className="print-header-meta">
                <span>PRICE REPORT</span>
                <small>
                  {selectedCategory || "ไม่ระบุหมวด"} • {modeLabel(form.mode)} • {form.projectDate}
                </small>
              </div>
            </header>

            <div className="print-overview">
              <section className="print-summary-panel">
                <p className="print-eyebrow">REPORT SUMMARY</p>
                <div className="print-title-row">
                  <div>
                    <h1>{form.productName || "สรุปราคาสินค้านำเข้า"}</h1>
                    <p>{form.detail || "สรุปราคาสินค้าพร้อมต้นทุนและกำไร"}</p>
                  </div>
                  {form.productImageUrl ? (
                    <img
                      className="print-product-thumb"
                      alt={form.productName || "รูปภาพสินค้า"}
                      src={form.productImageUrl}
                    />
                  ) : null}
                </div>

                <div className="print-price-hero">
                  <span>ราคาขายแนะนำ / ชิ้น</span>
                  <strong>{result ? baht.format(result.sellingPricePerUnit) : "—"}</strong>
                  <b>GP {imageCurrency.format(form.gpMarginPct)}%</b>
                </div>

                <div className="print-stat-grid">
                  <div className="orange"><span>ต้นทุนรวม</span><strong>{result ? baht.format(result.totalCost) : "—"}</strong></div>
                  <div className="blue"><span>ต้นทุน / ชิ้น</span><strong>{result ? baht.format(result.costPerUnit) : "—"}</strong></div>
                  <div className="navy"><span>ราคาขายแนะนำ</span><strong>{result ? baht.format(result.sellingPricePerUnit) : "—"}</strong></div>
                  <div className="green"><span>กำไรรวม</span><strong>{result ? baht.format(result.totalProfit) : "—"}</strong></div>
                </div>
              </section>

              <aside className="print-cost-panel">
                <h2><span>฿</span>รายละเอียดต้นทุน</h2>
                <dl className="print-cost-list">
                  <div><dt>ราคา EXW / ชิ้น</dt><dd>{imageCurrency.format(form.unitForeignPrice)} {form.currencyCode}</dd></div>
                  <div><dt>อัตราแลกเปลี่ยน</dt><dd>{imageCurrency.format(form.exchangeRate)} บาท</dd></div>
                  <div><dt>จำนวน</dt><dd>{imageCurrency.format(form.quantity)} ชิ้น</dd></div>
                  <div><dt>GP Margin</dt><dd>{imageCurrency.format(form.gpMarginPct)}%</dd></div>
                  <div><dt>ค่าขนส่งต่างประเทศ /EA</dt><dd>{result ? baht.format(result.internationalFreightPerUnit) : "—"}</dd></div>
                  <div><dt>แพ็กและขนส่งในประเทศ /EA</dt><dd>{result ? baht.format(result.domesticPackingPerUnit) : "—"}</dd></div>
                  <div><dt>ค่าขนส่งต่างประเทศรวม</dt><dd>{result ? baht.format(result.internationalFreightCost) : "—"}</dd></div>
                  <div><dt>แพ็กและขนส่งในประเทศรวม</dt><dd>{result ? baht.format(result.domesticPackingCost) : "—"}</dd></div>
                  {form.mode === "ADVANCED" ? (
                    <>
                      <div><dt>มูลค่า CIF</dt><dd>{result ? baht.format(result.cifValue) : "—"}</dd></div>
                      <div><dt>อากรขาเข้า</dt><dd>{result ? baht.format(result.importDuty) : "—"}</dd></div>
                      <div><dt>VAT นำเข้า</dt><dd>{result ? baht.format(result.importVat) : "—"}</dd></div>
                    </>
                  ) : null}
                </dl>
                <div className="print-total-cost">
                  <span>ต้นทุนรวม</span>
                  <strong>{result ? baht.format(result.totalCost) : "—"}</strong>
                </div>
                <p>ประมาณการเพื่อประกอบการตัดสินใจ ไม่ใช่เอกสารศุลกากร</p>
              </aside>
            </div>

            <section className="print-volume-panel">
              <div className="print-volume-head">
                <div>
                  <p className="print-eyebrow">VOLUME PRICING</p>
                  <h2>ราคาขั้นบันไดตามปริมาณ</h2>
                </div>
                <span>{volumeRows.length} ระดับราคา</span>
              </div>
              <table className="print-volume-table">
                <thead>
                  <tr>
                    <th>ช่วงจำนวน (ชิ้น)</th>
                    <th>จำนวน</th>
                    <th>ลด (%)</th>
                    <th>ราคาต่อหน่วย</th>
                    <th>กำไร / หน่วย</th>
                    <th>MARGIN รวม</th>
                    <th>MARGIN %</th>
                  </tr>
                </thead>
                <tbody>
                  {volumeRows.map((tier, index) => (
                    <tr key={`print-${tier.qty}-${index}`}>
                      <td>{tier.qty}</td>
                      <td>{number.format(tier.quantity)}</td>
                      <td><span className={tier.discount > 0 ? "discount" : "neutral"}>{number.format(tier.discount)}%</span></td>
                      <td>{baht.format(tier.price)}</td>
                      <td className={tier.profit >= 0 ? "profit" : "loss"}>{baht.format(tier.profit)}</td>
                      <td>{tier.totalMargin === null ? "—" : baht.format(tier.totalMargin)}</td>
                      <td><span className={tier.margin >= 20 ? "healthy" : "neutral"}>{formatPercent(tier.margin)}</span></td>
                    </tr>
                  ))}
                </tbody>
              </table>
              <footer>
                <span>ราคาแต่ละระดับคำนวณจากราคาขายแนะนำ หักส่วนลดตามปริมาณ</span>
                <span>Import Price Studio • {form.projectDate}</span>
              </footer>
            </section>
          </section>
        </div>
      ) : null}

      {!loading && tab === "projects" ? (
        <section className="workspace no-print">
          <section className="hero compact">
            <div>
              <p className="eyebrow">PROJECT LIBRARY</p>
              <h1>โปรเจกต์ของฉัน</h1>
              <p>ค้นหา เปรียบเทียบ และนำต้นทุนเดิมกลับมาใช้ได้ทันที</p>
            </div>
            <button
              className="button primary"
              onClick={() => {
                resetForm();
                setTab("calculator");
              }}
            >
              ＋ สร้างโปรเจกต์
            </button>
          </section>

          <div className="toolbar">
            <label className="search-field">
              <span aria-hidden="true">⌕</span>
              <input
                placeholder="ค้นหาชื่อสินค้าหรือรายละเอียด"
                value={search}
                onChange={(event) => setSearch(event.target.value)}
              />
            </label>
            <select
              aria-label="กรองหมวดสินค้า"
              value={filterCategory}
              onChange={(event) => setFilterCategory(event.target.value)}
            >
              <option value="">ทุกหมวด</option>
              {categories.map((category) => (
                <option key={category.id} value={category.id}>
                  {category.name}
                </option>
              ))}
            </select>
              <select
                aria-label="กรองโหมดคำนวณ"
                value={filterMode}
                onChange={(event) => setFilterMode(event.target.value)}
              >
                <option value="">ทุกโหมด</option>
                <option value="SIMPLE">โหมดง่าย</option>
                <option value="ADVANCED">โหมดละเอียด</option>
              </select>
          </div>

          <div className="backup-bar">
            <div>
              <strong>สำรองข้อมูล</strong>
              <span>เก็บหมวดและโปรเจกต์ทั้งหมดเป็นไฟล์ JSON</span>
            </div>
            <div className="backup-actions">
              <button className="button secondary" onClick={backup}>
                ↓ Backup
              </button>
              <select
                aria-label="รูปแบบการกู้คืน"
                value={restoreMode}
                onChange={(event) =>
                  setRestoreMode(event.target.value as "merge" | "replace")
                }
              >
                <option value="replace">แทนที่ข้อมูลเดิม</option>
                <option value="merge">รวมกับข้อมูลเดิม</option>
              </select>
              <button
                className="button ghost"
                onClick={() => restoreInput.current?.click()}
              >
                ↑ Restore
              </button>
              <input
                accept="application/json,.json"
                hidden
                onChange={restore}
                ref={restoreInput}
                type="file"
              />
            </div>
          </div>

          <div className="project-count">
            แสดง {filteredProjects.length} จาก {projects.length} โปรเจกต์
          </div>
          {filteredProjects.length === 0 ? (
            <div className="empty-state">
              <span>▤</span>
              <h2>ยังไม่พบโปรเจกต์</h2>
              <p>ลองเปลี่ยนตัวกรอง หรือสร้างโปรเจกต์ราคาใหม่</p>
            </div>
          ) : (
            <div className="project-grid">
              {filteredProjects.map((project) => (
                <article className="project-card" key={project.id}>
                  <div className="project-card-head">
                    <span className={`mode-chip ${project.mode.toLowerCase()}`}>
                      {modeLabel(project.mode)}
                    </span>
                    <time>{project.projectDate}</time>
                  </div>
                  {project.productImageUrl ? (
                    <div className="project-card-image">
                      <img
                        alt={project.productName || "รูปภาพสินค้า"}
                        src={project.productImageUrl}
                      />
                    </div>
                  ) : null}
                  <h2>{project.productName}</h2>
                  <p className="category-label">
                    {project.category?.name ?? "ไม่ระบุหมวด"}
                  </p>
                  <div className="project-price">
                    <span>ราคาขายแนะนำ</span>
                    <strong>{baht.format(project.sellingPricePerUnit)}</strong>
                    <small>/ ชิ้น</small>
                  </div>
                  <div className="project-stats">
                    <div>
                      <span>ต้นทุนรวม</span>
                      <strong>{baht.format(project.totalCost)}</strong>
                    </div>
                    <div>
                      <span>กำไรรวม</span>
                      <strong className="positive">
                        {baht.format(project.totalProfit)}
                      </strong>
                    </div>
                  </div>
                  <div className="card-actions">
                    <button onClick={() => editProject(project)}>แก้ไข</button>
                    <button onClick={() => void shareProject(project.id)}>
                      แชร์
                    </button>
                    <button onClick={() => void duplicateProject(project.id)}>
                      คัดลอก
                    </button>
                    <button
                      className="danger"
                      onClick={() => void deleteProject(project.id)}
                    >
                      ลบ
                    </button>
                  </div>
                </article>
              ))}
            </div>
          )}
        </section>
      ) : null}

      {!loading && tab === "categories" ? (
        <section className="workspace no-print">
          <section className="hero compact">
            <div>
              <p className="eyebrow">CATEGORY SETTINGS</p>
              <h1>จัดการหมวดสินค้า</h1>
              <p>
                สร้าง Dropdown ให้ตรงกับสินค้าของธุรกิจ โดยไม่ล็อกชื่อไว้ล่วงหน้า
              </p>
            </div>
          </section>
          <section className="panel category-panel">
            <SectionTitle
              index="01"
              title="เพิ่มหมวดใหม่"
              description="ชื่อหมวดต้องไม่ซ้ำกัน"
            />
            <div className="add-category">
              <input
                maxLength={100}
                onChange={(event) => setNewCategoryName(event.target.value)}
                onKeyDown={(event) => {
                  if (event.key === "Enter") void addCategory();
                }}
                placeholder="เช่น วัตถุดิบ, เครื่องจักร, อะไหล่"
                value={newCategoryName}
              />
              <button className="button primary" onClick={() => void addCategory()}>
                เพิ่มหมวด
              </button>
            </div>
          </section>
          <section className="panel category-panel">
            <SectionTitle
              index="02"
              title="หมวดสินค้าทั้งหมด"
              description={`${categories.length} หมวด`}
            />
            <div className="category-list">
              {categories.map((category) => (
                <article
                  className={`category-row ${!category.isActive ? "inactive" : ""}`}
                  key={category.id}
                >
                  <div className="category-main">
                    <input
                      aria-label={`ชื่อหมวด ${category.name}`}
                      maxLength={100}
                      value={categoryDrafts[category.id] ?? category.name}
                      onChange={(event) =>
                        setCategoryDrafts((current) => ({
                          ...current,
                          [category.id]: event.target.value,
                        }))
                      }
                    />
                    <span>{category.projectCount} โปรเจกต์</span>
                  </div>
                  <div className="category-actions">
                    <button
                      className="button ghost small-button"
                      disabled={
                        !categoryDrafts[category.id]?.trim() ||
                        categoryDrafts[category.id]?.trim() === category.name
                      }
                      onClick={() =>
                        void updateCategory(category.id, {
                          name: categoryDrafts[category.id]?.trim(),
                        })
                      }
                    >
                      บันทึกชื่อ
                    </button>
                    <label className="mini-toggle">
                      <input
                        checked={category.isActive}
                        onChange={(event) =>
                          void updateCategory(category.id, {
                            isActive: event.target.checked,
                          })
                        }
                        type="checkbox"
                      />
                      <span>{category.isActive ? "ใช้งาน" : "ปิดใช้"}</span>
                    </label>
                    <button
                      className="icon-button danger"
                      disabled={category.projectCount > 0}
                      onClick={() => void deleteCategory(category.id)}
                      title={
                        category.projectCount > 0
                          ? "หมวดนี้มีโปรเจกต์ใช้งานอยู่"
                          : "ลบหมวด"
                      }
                    >
                      ×
                    </button>
                  </div>
                </article>
              ))}
            </div>
          </section>
        </section>
      ) : null}
    </main>
  );
}
