"use client";

import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Sparkles } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { authFetch } from "@/lib/firebase/auth";
import { toast } from "sonner";
import { formatDate } from "@/components/admin/admin-shared";
import type { UserRow } from "@/components/admin/admin-shared";
import type { Department } from "@/lib/types";

export function UsersTab({
  users,
  setUsers,
  isSuperAdmin,
  orgDepartments,
  userDeptFilter,
  setUserDeptFilter,
  userAiDashCount,
  userMcpAccess,
}: {
  users: UserRow[];
  setUsers: React.Dispatch<React.SetStateAction<UserRow[]>>;
  isSuperAdmin: boolean;
  orgDepartments: Department[];
  userDeptFilter: string;
  setUserDeptFilter: React.Dispatch<React.SetStateAction<string>>;
  userAiDashCount: Map<string, number>;
  userMcpAccess: Map<string, string[]>;
}) {
  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between">
          <div>
            <CardTitle className="text-base">User Activity</CardTitle>
            <CardDescription>{users.length} registered users</CardDescription>
          </div>
          {isSuperAdmin && orgDepartments.length > 0 && (
            <select
              value={userDeptFilter}
              onChange={(e) => setUserDeptFilter(e.target.value)}
              className="bg-transparent border rounded px-2 py-1 text-sm cursor-pointer"
            >
              <option value="all">All Departments</option>
              <option value="none">No Department</option>
              {orgDepartments.map((d) => (
                <option key={d.id} value={d.id}>
                  {d.name}
                </option>
              ))}
            </select>
          )}
        </div>
      </CardHeader>
      <CardContent>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b text-left text-muted-foreground">
                <th className="pb-2 pr-4">Name</th>
                <th className="hidden md:table-cell pb-2 pr-4">Email</th>
                <th className="pb-2 pr-4">Role</th>
                {isSuperAdmin && <th className="hidden md:table-cell pb-2 pr-4">Department</th>}
                <th className="hidden md:table-cell pb-2 pr-4 text-right">Dashboards</th>
                {isSuperAdmin && <th className="hidden lg:table-cell pb-2 pr-4">MCP Access</th>}
                <th className="hidden md:table-cell pb-2 pr-4 text-right">Views Generated</th>
                <th className="pb-2">Last Login</th>
              </tr>
            </thead>
            <tbody>
              {users
                .filter((u) => {
                  if (userDeptFilter === "all") return true;
                  if (userDeptFilter === "none") return !u.department;
                  return u.department === userDeptFilter;
                })
                .map((u) => {
                  const deptName = u.department
                    ? orgDepartments.find((d) => d.id === u.department)?.name
                    : undefined;
                  return (
                    <tr
                      key={u.uid}
                      className="border-b border-muted hover:bg-muted/50"
                    >
                      <td className="py-2 pr-4 font-medium">
                        {u.displayName}
                      </td>
                      <td className="hidden md:table-cell py-2 pr-4 text-muted-foreground">
                        {u.email}
                      </td>
                      <td className="py-2 pr-4">
                        {isSuperAdmin ? (
                          <select
                            value={u.role}
                            onChange={async (e) => {
                              const newRole = e.target.value;
                              if (newRole === u.role) return;
                              if (
                                !confirm(
                                  `Change ${u.displayName}'s role from "${u.role}" to "${newRole}"?`
                                )
                              ) {
                                e.target.value = u.role;
                                return;
                              }
                              try {
                                const res = await authFetch("/api/admin/users", {
                                  method: "PATCH",
                                  headers: { "Content-Type": "application/json" },
                                  body: JSON.stringify({ uid: u.uid, role: newRole }),
                                });
                                if (!res.ok) {
                                  const err = await res.json();
                                  throw new Error(err.error || "Failed");
                                }
                                setUsers((prev) =>
                                  prev.map((user) =>
                                    user.uid === u.uid ? { ...user, role: newRole } : user
                                  )
                                );
                                toast.success(`${u.displayName} is now ${newRole}`);
                              } catch (err) {
                                e.target.value = u.role;
                                toast.error(
                                  err instanceof Error ? err.message : "Failed to update role"
                                );
                              }
                            }}
                            className={`bg-transparent border rounded px-1.5 py-0.5 text-sm cursor-pointer ${
                              u.role === "superadmin"
                                ? "text-amber-600 font-medium border-amber-300"
                                : u.role === "admin"
                                  ? "text-blue-600 font-medium border-blue-300"
                                  : "text-muted-foreground border-muted"
                            }`}
                          >
                            <option value="user">user</option>
                            <option value="admin">admin</option>
                            <option value="superadmin">superadmin</option>
                          </select>
                        ) : (
                          <span
                            className={`inline-flex rounded border px-1.5 py-0.5 text-sm ${
                              u.role === "superadmin"
                                ? "text-amber-600 font-medium border-amber-300"
                                : u.role === "admin"
                                  ? "text-blue-600 font-medium border-blue-300"
                                  : "text-muted-foreground border-muted"
                            }`}
                          >
                            {u.role}
                          </span>
                        )}
                      </td>
                      {isSuperAdmin && (
                        <td className="hidden md:table-cell py-2 pr-4">
                          {deptName ? (
                            <span className="inline-flex items-center rounded-full bg-muted px-2 py-0.5 text-xs font-medium">
                              {deptName}
                            </span>
                          ) : (
                            <span className="text-muted-foreground text-xs">—</span>
                          )}
                        </td>
                      )}
                      <td className="hidden md:table-cell py-2 pr-4 text-right tabular-nums">
                        <span>{u.dashboardsCreated}</span>
                        {(userAiDashCount.get(u.email) || 0) > 0 && (
                          <Badge variant="secondary" className="ml-1.5 text-[10px] px-1 py-0">
                            <Sparkles className="size-2.5 mr-0.5" />
                            {userAiDashCount.get(u.email)}
                          </Badge>
                        )}
                      </td>
                      {isSuperAdmin && (
                        <td className="hidden lg:table-cell py-2 pr-4">
                          {(userMcpAccess.get(u.uid) || []).length > 0 ? (
                            <div className="flex flex-wrap gap-1">
                              {userMcpAccess.get(u.uid)!.map((name) => (
                                <span
                                  key={name}
                                  className="inline-flex items-center rounded bg-muted px-1.5 py-0 text-[10px] font-medium"
                                >
                                  {name}
                                </span>
                              ))}
                            </div>
                          ) : (
                            <span className="text-muted-foreground text-xs">—</span>
                          )}
                        </td>
                      )}
                      <td className="hidden md:table-cell py-2 pr-4 text-right tabular-nums">
                        {u.totalViewsGenerated}
                      </td>
                      <td className="py-2 text-muted-foreground">
                        {formatDate(u.lastLoginAt)}
                      </td>
                    </tr>
                  );
                })}
            </tbody>
          </table>
        </div>
      </CardContent>
    </Card>
  );
}
