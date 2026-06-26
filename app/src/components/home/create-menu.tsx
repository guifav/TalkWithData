"use client";

import Link from "next/link";
import {
  ChevronDown,
  Compass,
  MessageSquare,
  Plus,
  Sparkles,
  Upload,
} from "lucide-react";

import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";

export function CreateMenu({ hasMcpAccess }: { hasMcpAccess: boolean }) {
  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button>
          <Plus className="size-4" />
          Novo dashboard
          <ChevronDown className="size-4 opacity-70" />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-72">
        <DropdownMenuLabel>Como você quer começar?</DropdownMenuLabel>
        <DropdownMenuSeparator />
        {hasMcpAccess && (
          <DropdownMenuItem asChild className="py-2">
            <Link href="/create">
              <div className="flex items-start gap-3">
                <Sparkles className="size-4 mt-0.5 shrink-0" />
                <div className="flex flex-col">
                  <span className="font-medium flex items-center gap-1.5">
                    Criar com IA
                    <span className="inline-flex items-center rounded-full bg-purple-100 px-1.5 py-0 text-[10px] font-medium uppercase tracking-wide text-purple-800 dark:bg-purple-900/40 dark:text-purple-300">
                      Beta
                    </span>
                  </span>
                  <span className="text-xs text-muted-foreground">
                    Gere um dashboard a partir de um briefing · em testes
                  </span>
                </div>
              </div>
            </Link>
          </DropdownMenuItem>
        )}
        {hasMcpAccess && (
          <>
            <DropdownMenuItem asChild className="py-2">
              <Link href="/chat">
                <div className="flex items-start gap-3">
                  <MessageSquare className="size-4 mt-0.5 shrink-0" />
                  <div className="flex flex-col">
                    <span className="font-medium">Conversar com dados</span>
                    <span className="text-xs text-muted-foreground">
                      Explore e construa em um chat iterativo
                    </span>
                  </div>
                </div>
              </Link>
            </DropdownMenuItem>
            <DropdownMenuItem asChild className="py-2">
              <Link href="/explore">
                <div className="flex items-start gap-3">
                  <Compass className="size-4 mt-0.5 shrink-0" />
                  <div className="flex flex-col">
                    <span className="font-medium">Explorar dados</span>
                    <span className="text-xs text-muted-foreground">
                      Veja o que os MCPs autorizados oferecem
                    </span>
                  </div>
                </div>
              </Link>
            </DropdownMenuItem>
          </>
        )}
        <DropdownMenuSeparator />
        <DropdownMenuItem asChild className="py-2">
          <Link href="/upload">
            <div className="flex items-start gap-3">
              <Upload className="size-4 mt-0.5 shrink-0" />
              <div className="flex flex-col">
                <span className="font-medium">Upload de arquivo</span>
                <span className="text-xs text-muted-foreground">
                  Publique um HTML ou ZIP pronto
                </span>
              </div>
            </div>
          </Link>
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
