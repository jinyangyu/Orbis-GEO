"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  engineFilterFromLabel,
  fetchCitationsMetrics,
  fetchMonitoringWorkspaces,
  fetchOverviewMetrics,
  fetchPromptDetail,
  fetchPromptsMetrics,
  fetchWorkspaceById,
  getStoredWorkspaceId,
  setStoredWorkspaceId,
} from "@/lib/metrics/client";
import type { DateRangeValue } from "@/lib/report/date-range";
import type {
  CitationsMetrics,
  OverviewMetrics,
  PromptDetailMetrics,
  PromptMetricRow,
  PromptsMetrics,
  WorkspaceListItem,
} from "@/lib/metrics/types";
import type { WorkspacePayload } from "@/lib/onboarding/types";
import { checkNotificationsClient } from "@/lib/notifications/client";
import type { PageKey } from "./types";

export function useDashboardData({
  experience,
  page,
  dateRange,
  engine,
  market,
  reportOpen,
  drawerPrompt,
}: {
  experience: "onboarding" | "dashboard";
  page: PageKey;
  dateRange: DateRangeValue;
  engine: string;
  market: string;
  reportOpen: boolean;
  drawerPrompt: PromptMetricRow | null;
}) {
  const [workspace, setWorkspace] = useState<WorkspacePayload | null>(null);
  const [workspaceList, setWorkspaceList] = useState<WorkspaceListItem[]>([]);
  const [workspaceId, setWorkspaceId] = useState<string | null>(null);
  const [overview, setOverview] = useState<OverviewMetrics | null>(null);
  const [promptsData, setPromptsData] = useState<PromptsMetrics | null>(null);
  const [citations, setCitations] = useState<CitationsMetrics | null>(null);
  const [loadingOverview, setLoadingOverview] = useState(false);
  const [loadingPrompts, setLoadingPrompts] = useState(false);
  const [loadingCitations, setLoadingCitations] = useState(false);
  const [metricsError, setMetricsError] = useState("");
  const [drawerDetail, setDrawerDetail] = useState<PromptDetailMetrics | null>(
    null,
  );
  const [notifyRefresh, setNotifyRefresh] = useState(0);

  const overviewAbort = useRef<AbortController | null>(null);
  const promptsAbort = useRef<AbortController | null>(null);
  const citationsAbort = useRef<AbortController | null>(null);
  const promptsKeyRef = useRef("");
  const citationsKeyRef = useRef("");
  const notifyWsRef = useRef<string | null>(null);
  const workspaceIdRef = useRef<string | null>(null);

  const rangeDays = dateRange.days;
  const rangeFrom = dateRange.from;
  const rangeTo = dateRange.to;
  const engineCode = engineFilterFromLabel(engine);
  const filterKey = `${rangeFrom}|${rangeTo}|${rangeDays}|${engineCode ?? "all"}`;

  const loadDashboard = useCallback(
    async (preferredId?: string | null) => {
      overviewAbort.current?.abort();
      const incoming = preferredId ?? getStoredWorkspaceId() ?? workspaceIdRef.current;
      const switchingWorkspace = Boolean(
        incoming && workspaceIdRef.current && incoming !== workspaceIdRef.current,
      );
      if (switchingWorkspace) {
        promptsAbort.current?.abort();
        citationsAbort.current?.abort();
        setOverview(null);
        setPromptsData(null);
        setCitations(null);
        promptsKeyRef.current = "";
        citationsKeyRef.current = "";
        setLoadingPrompts(true);
        setLoadingCitations(true);
      }
      const ac = new AbortController();
      overviewAbort.current = ac;

      setLoadingOverview(true);
      setMetricsError("");

      try {
        const list = await fetchMonitoringWorkspaces(ac.signal);
        setWorkspaceList(list);
        const stored = preferredId ?? getStoredWorkspaceId();
        const validStored =
          stored && stored !== "undefined" && list.some((w) => w.id === stored)
            ? stored
            : null;
        const selected = validStored ?? list[0]?.id ?? null;
        if (!selected) {
          workspaceIdRef.current = null;
          promptsAbort.current?.abort();
          citationsAbort.current?.abort();
          setWorkspaceId(null);
          setWorkspace(null);
          setOverview(null);
          setPromptsData(null);
          setCitations(null);
          setMetricsError("暂无监测数据，请先导入 inspection 答卷。");
          return;
        }
        workspaceIdRef.current = selected;
        setStoredWorkspaceId(selected);
        setWorkspaceId(selected);
        const [ws, ov] = await Promise.all([
          fetchWorkspaceById(selected, ac.signal),
          fetchOverviewMetrics(selected, {
            engine: engineCode,
            days: rangeDays,
            from: rangeFrom,
            to: rangeTo,
            market: market || undefined,
            signal: ac.signal,
          }),
        ]);
        setWorkspace(ws);
        setOverview(ov);
        if (notifyWsRef.current !== selected) {
          notifyWsRef.current = selected;
          void checkNotificationsClient(selected, ov.actions ?? [])
            .then(() => setNotifyRefresh((n) => n + 1))
            .catch(() => {
              /* tables may not exist yet */
            });
        }
      } catch (err) {
        if (err instanceof DOMException && err.name === "AbortError") return;
        if (err instanceof Error && err.name === "AbortError") return;
        setMetricsError(err instanceof Error ? err.message : "加载失败");
      } finally {
        if (!ac.signal.aborted) setLoadingOverview(false);
      }
    },
    [engineCode, rangeDays, rangeFrom, rangeTo, market],
  );

  useEffect(() => {
    if (experience === "dashboard") void loadDashboard();
  }, [experience, loadDashboard]);

  useEffect(() => {
    if (experience !== "dashboard" || !workspaceId) return;
    if (
      page !== "prompts" &&
      page !== "overview" &&
      page !== "citations" &&
      page !== "recommendations"
    ) {
      return;
    }
    const key = `${workspaceId}|${filterKey}|prompts`;
    if (promptsKeyRef.current === key) return;

    promptsAbort.current?.abort();
    const ac = new AbortController();
    promptsAbort.current = ac;
    setLoadingPrompts(true);
    void fetchPromptsMetrics(workspaceId, {
      engine: engineCode,
      days: rangeDays,
      from: rangeFrom,
      to: rangeTo,
      market: market || undefined,
      signal: ac.signal,
    })
      .then((data) => {
        if (ac.signal.aborted) return;
        setPromptsData(data);
        promptsKeyRef.current = key;
      })
      .catch((err) => {
        if (err instanceof DOMException && err.name === "AbortError") return;
        if (err instanceof Error && err.name === "AbortError") return;
        setMetricsError(err instanceof Error ? err.message : "Prompts 加载失败");
      })
      .finally(() => {
        if (!ac.signal.aborted) setLoadingPrompts(false);
      });
  }, [
    experience,
    page,
    workspaceId,
    filterKey,
    engineCode,
    rangeDays,
    rangeFrom,
    rangeTo,
    market,
  ]);

  useEffect(() => {
    if (experience !== "dashboard" || !workspaceId) return;
    if (page !== "citations" && !reportOpen) return;
    const key = `${workspaceId}|${filterKey}|citations`;
    if (citationsKeyRef.current === key) return;

    citationsAbort.current?.abort();
    const ac = new AbortController();
    citationsAbort.current = ac;
    setLoadingCitations(true);
    void fetchCitationsMetrics(workspaceId, {
      engine: engineCode,
      days: rangeDays,
      from: rangeFrom,
      to: rangeTo,
      signal: ac.signal,
    })
      .then((data) => {
        if (ac.signal.aborted) return;
        setCitations(data);
        citationsKeyRef.current = key;
      })
      .catch((err) => {
        if (err instanceof DOMException && err.name === "AbortError") return;
        if (err instanceof Error && err.name === "AbortError") return;
        if (page === "citations") {
          setMetricsError(err instanceof Error ? err.message : "引用分析加载失败");
        }
      })
      .finally(() => {
        if (!ac.signal.aborted) setLoadingCitations(false);
      });
  }, [
    experience,
    page,
    workspaceId,
    filterKey,
    engineCode,
    rangeDays,
    rangeFrom,
    rangeTo,
    reportOpen,
  ]);

  useEffect(() => {
    if (!drawerPrompt || !workspaceId) {
      setDrawerDetail(null);
      return;
    }
    const ac = new AbortController();
    void fetchPromptDetail(workspaceId, drawerPrompt.promptId, {
      days: rangeDays,
      from: rangeFrom,
      to: rangeTo,
      engine: engineCode,
      signal: ac.signal,
    })
      .then(setDrawerDetail)
      .catch(() => {
        if (!ac.signal.aborted) setDrawerDetail(null);
      });
    return () => ac.abort();
  }, [drawerPrompt, workspaceId, rangeDays, rangeFrom, rangeTo, engineCode]);

  const overviewTopPrompts = useMemo(() => {
    const items = promptsData?.items ?? [];
    if (!items.length) return [];
    return [...items]
      .sort((a, b) => b.brandMentions - a.brandMentions || b.coverage - a.coverage)
      .slice(0, 6)
      .map((p) => ({ promptId: p.promptId, q: p.q, count: p.brandMentions }));
  }, [promptsData]);

  const engineOptions = useMemo(() => {
    const fromOverview =
      overview?.engines.map((e) => ({
        code: e.code,
        name: e.name,
        mark: e.mark,
      })) ?? [];
    if (fromOverview.length) return fromOverview;
    return [
      { code: "deepseek", name: "DeepSeek", mark: "D" },
      { code: "doubao", name: "Doubao", mark: "豆" },
      { code: "gpt", name: "ChatGPT", mark: "G" },
    ];
  }, [overview]);

  const tagOptions = useMemo(() => {
    const set = new Set<string>();
    for (const row of promptsData?.items ?? []) {
      if (row.tag) set.add(row.tag);
    }
    for (const row of overview?.attentionPrompts ?? []) {
      if (row.tag) set.add(row.tag);
    }
    return [...set];
  }, [promptsData, overview]);

  const marketOptions = useMemo(() => {
    if (promptsData?.markets?.length) return promptsData.markets;
    const set = new Set<string>();
    for (const row of overview?.attentionPrompts ?? []) {
      if (row.market) set.add(row.market);
    }
    return [...set];
  }, [promptsData, overview]);

  const switchWorkspace = (nextId: string): WorkspaceListItem | null => {
    if (!nextId || nextId === workspaceId) return null;
    const next = workspaceList.find((w) => w.id === nextId);
    if (!next) return null;
    setStoredWorkspaceId(next.id);
    setWorkspaceId(next.id);
    setOverview(null);
    setWorkspace(null);
    setPromptsData(null);
    setCitations(null);
    promptsKeyRef.current = "";
    citationsKeyRef.current = "";
    void loadDashboard(next.id);
    return next;
  };

  const invalidatePrompts = () => {
    promptsKeyRef.current = "";
  };

  return {
    workspace,
    workspaceList,
    workspaceId,
    overview,
    promptsData,
    citations,
    loadingOverview,
    loadingPrompts,
    loadingCitations,
    metricsError,
    drawerDetail,
    notifyRefresh,
    engineCode,
    filterKey,
    overviewTopPrompts,
    engineOptions,
    tagOptions,
    marketOptions,
    loadDashboard,
    switchWorkspace,
    invalidatePrompts,
  };
}
