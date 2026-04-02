import { useEffect, useRef } from "react";
import { io, Socket } from "socket.io-client";

type LeaderboardEntry = {
  rank: number;
  studentId: string;
  firstName: string;
  lastName: string;
  classCode: string;
  branchName: string;
  institutionName: string;
  totalStars: number;
  totalBadges: number;
  monthlyStars: number;
  monthlyBadges: number;
};

type UpdatePayload = {
  type: "school" | "monthly";
  entries: LeaderboardEntry[];
};

type Options = {
  institutionId?: string | null;
  studentId?: string | null;
  onUpdate: (payload: UpdatePayload) => void;
};

export function useLeaderboardSocket({ institutionId, studentId, onUpdate }: Options) {
  const socketRef = useRef<Socket | null>(null);
  const onUpdateRef = useRef(onUpdate);
  onUpdateRef.current = onUpdate;

  useEffect(() => {
    const hasId = institutionId || studentId;
    if (!hasId) return;

    const serverUrl = (import.meta.env.VITE_API_URL as string) || "";

    const query: Record<string, string> = {};
    if (institutionId) query.institutionId = institutionId;
    else if (studentId) query.studentId = studentId;

    const socket = io(serverUrl, {
      query,
      transports: ["websocket", "polling"],
      withCredentials: true,
    });

    socketRef.current = socket;

    socket.on("leaderboard:update", (payload: UpdatePayload) => {
      onUpdateRef.current(payload);
    });

    return () => {
      socket.disconnect();
      socketRef.current = null;
    };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [institutionId, studentId]);
}
