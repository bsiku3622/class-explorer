import type { AxiosProgressEvent } from "axios";
import api from "./api";
import { authHeader } from "./session";
import type {
    Material,
    MaterialCategory,
    MaterialSubject,
    Term,
} from "../types";

const approvedCache = new Map<string, Promise<Material[]>>();
const termKey = (term: Term): string => `${term.year}-${term.semester}`;

export const MATERIAL_CATEGORY_LABELS: Record<MaterialCategory, string> = {
    syllabus: "Syllabus",
    lecture_note: "Lecture Note",
    worksheet: "Worksheet",
    assignment: "Assignment",
    reference: "Reference",
    other: "Other",
};

export const MATERIAL_CATEGORIES = Object.keys(
    MATERIAL_CATEGORY_LABELS,
) as MaterialCategory[];

export const getApprovedMaterials = (
    term: Term,
    refresh = false,
): Promise<Material[]> => {
    const key = termKey(term);
    if (refresh) approvedCache.delete(key);
    const cached = approvedCache.get(key);
    if (cached) return cached;

    const request = api
        .get<Material[]>("/materials", {
            headers: authHeader(),
            params: { year: term.year, semester: term.semester },
        })
        .then((response) => response.data)
        .catch((error) => {
            approvedCache.delete(key);
            throw error;
        });
    approvedCache.set(key, request);
    return request;
};

export const getMaterialSubjects = async (
    term: Term,
): Promise<MaterialSubject[]> => {
    const response = await api.get<MaterialSubject[]>("/materials/subjects", {
        headers: authHeader(),
        params: { year: term.year, semester: term.semester },
    });
    return response.data;
};

export const getMyMaterials = async (): Promise<Material[]> => {
    const response = await api.get<Material[]>("/materials/mine", {
        headers: authHeader(),
    });
    return response.data;
};

export interface MaterialUploadInput {
    title: string;
    subjectId: number;
    term: Term;
    category: MaterialCategory;
    description: string;
    files: File[];
}

export const uploadMaterial = async (
    input: MaterialUploadInput,
    onProgress?: (percent: number) => void,
): Promise<Material> => {
    const body = new FormData();
    body.append("title", input.title);
    body.append("subject_id", String(input.subjectId));
    body.append("year", String(input.term.year));
    body.append("semester", String(input.term.semester));
    body.append("category", input.category);
    body.append("description", input.description);
    input.files.forEach((file) => body.append("files", file));

    const response = await api.post<Material>("/materials", body, {
        headers: authHeader(),
        onUploadProgress: (event: AxiosProgressEvent) => {
            if (event.total && onProgress) {
                onProgress(Math.round((event.loaded / event.total) * 100));
            }
        },
    });
    return response.data;
};

export const updateMyMaterial = async (
    materialId: number,
    patch: Partial<Pick<Material, "title" | "category" | "description">> & {
        subject_id?: number;
    },
): Promise<Material> => {
    const response = await api.patch<Material>(
        `/materials/${materialId}`,
        patch,
        { headers: authHeader() },
    );
    return response.data;
};

export const withdrawMaterial = async (materialId: number): Promise<void> => {
    await api.delete(`/materials/${materialId}`, { headers: authHeader() });
};

export const getAdminMaterials = async (): Promise<Material[]> => {
    const response = await api.get<Material[]>("/admin/materials", {
        headers: authHeader(),
    });
    return response.data;
};

export interface MaterialDecisionInput {
    status: "approved" | "rejected";
    title?: string;
    subject_id?: number;
    category?: MaterialCategory;
    description?: string;
    rejection_reason?: string;
    primary_syllabus?: boolean;
}

export const decideMaterial = async (
    materialId: number,
    input: MaterialDecisionInput,
): Promise<Material> => {
    const response = await api.patch<Material>(
        `/admin/materials/${materialId}`,
        input,
        { headers: authHeader() },
    );
    approvedCache.clear();
    return response.data;
};

export const deleteMaterialAsAdmin = async (
    materialId: number,
): Promise<void> => {
    await api.delete(`/admin/materials/${materialId}`, {
        headers: authHeader(),
    });
    approvedCache.clear();
};

export const getMaterialFileBlob = async (
    fileId: number,
    mode: "preview" | "download",
): Promise<Blob> => {
    const response = await api.get<Blob>(
        `/materials/files/${fileId}/${mode}`,
        { headers: authHeader(), responseType: "blob" },
    );
    return response.data;
};

export const downloadMaterialFile = async (
    fileId: number,
    filename: string,
): Promise<void> => {
    const blob = await getMaterialFileBlob(fileId, "download");
    const url = URL.createObjectURL(blob);
    const anchor = document.createElement("a");
    anchor.href = url;
    anchor.download = filename.split("/").pop() || filename;
    document.body.appendChild(anchor);
    anchor.click();
    anchor.remove();
    URL.revokeObjectURL(url);
};
