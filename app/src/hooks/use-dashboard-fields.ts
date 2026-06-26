import { useState, useEffect, useCallback } from "react";
import { authFetch } from "@/lib/firebase/auth";

export interface FieldSchema {
  id: string;
  dashboardId: string;
  key: string;
  name: string;
  type: string;
  required: boolean;
  options: string[];
  order: number;
}

export interface FieldValues {
  [key: string]: {
    value: string | null;
    updatedBy: string | null;
    updatedAt: string;
  };
}

export function useDashboardFields(dashboardId: string | null) {
  const [fields, setFields] = useState<FieldSchema[]>([]);
  const [values, setValues] = useState<FieldValues>({});
  const [loading, setLoading] = useState(true);

  const fetchFields = useCallback(async () => {
    if (!dashboardId) {
      setLoading(false);
      return;
    }

    try {
      const [schemaRes, valuesRes] = await Promise.all([
        authFetch(`/api/dashboards/${dashboardId}/fields/schema`),
        authFetch(`/api/dashboards/${dashboardId}/fields/values`),
      ]);

      if (schemaRes.ok) {
        const schemaData = await schemaRes.json();
        setFields(schemaData.fields || []);
      }

      if (valuesRes.ok) {
        const valuesData = await valuesRes.json();
        setValues(valuesData.values || {});
      }
    } catch (error) {
      console.error("[useDashboardFields] Fetch failed:", error);
    } finally {
      setLoading(false);
    }
  }, [dashboardId]);

  useEffect(() => {
    fetchFields();
  }, [fetchFields]);

  const saveSchema = useCallback(
    async (newFields: Array<{ key: string; name: string; type: string; required: boolean; options: string[]; order: number }>) => {
      if (!dashboardId) return false;
      try {
        const res = await authFetch(`/api/dashboards/${dashboardId}/fields/schema`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ fields: newFields }),
        });

        if (res.ok) {
          const data = await res.json();
          setFields(data.fields || []);
          // Refetch values — schema save may have cleared incompatible values
          await fetchFields();
          return true;
        }
        return false;
      } catch {
        return false;
      }
    },
    [dashboardId, fetchFields]
  );

  const saveValues = useCallback(
    async (newValues: Record<string, string | null>) => {
      if (!dashboardId) return { success: false, errors: {} };
      try {
        const res = await authFetch(`/api/dashboards/${dashboardId}/fields/values`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ values: newValues }),
        });

        const data = await res.json();
        if (res.ok) {
          // Refresh values after save
          await fetchFields();
          return { success: true, errors: {} };
        }
        return { success: false, errors: data.errors || {} };
      } catch {
        return { success: false, errors: {} };
      }
    },
    [dashboardId, fetchFields]
  );

  return { fields, values, loading, saveSchema, saveValues, refetch: fetchFields };
}
