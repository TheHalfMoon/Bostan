import { ChevronsUpDown, Plus, RefreshCw, Settings } from "lucide-react";
import { Link } from "@/lib/router";
import { useCompany } from "../context/CompanyContext";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Button } from "@/components/ui/button";
import { useState } from "react";

function statusDotColor(status?: string): string {
  switch (status) {
    case "active":
      return "bg-green-400";
    case "paused":
      return "bg-yellow-400";
    case "archived":
      return "bg-neutral-400";
    default:
      return "bg-green-400";
  }
}

interface CompanySwitcherProps {
  open?: boolean;
  onOpenChange?: (open: boolean) => void;
  /** `sidebar` (default): full-width row. `titlebar`: compact bordered chip. */
  variant?: "sidebar" | "titlebar";
}

function companyInitials(name: string): string {
  const words = name.trim().split(/\s+/).filter(Boolean);
  return (words.length > 1 ? `${words[0][0]}${words[1][0]}` : name.slice(0, 2)).toUpperCase();
}

export function CompanySwitcher({ open: controlledOpen, onOpenChange, variant = "sidebar" }: CompanySwitcherProps = {}) {
  const [internalOpen, setInternalOpen] = useState(false);
  const { companies, selectedCompany, setSelectedCompanyId, companyListUnavailable, retryCompanies } =
    useCompany();
  const sidebarCompanies = companies.filter((company) => company.status !== "archived");
  const open = controlledOpen ?? internalOpen;
  const setOpen = onOpenChange ?? setInternalOpen;

  return (
    <DropdownMenu open={open} onOpenChange={setOpen}>
      <DropdownMenuTrigger asChild>
        {variant === "titlebar" ? (
          <Button
            variant="outline"
            size="sm"
            aria-label={selectedCompany ? `Organization: ${selectedCompany.name}. Switch organization` : "Select organization"}
            className="h-7 max-w-56 gap-2 rounded-md bg-card px-2 text-xs font-medium"
          >
            {selectedCompany ? (
              <span aria-hidden="true" className="flex size-4 shrink-0 items-center justify-center rounded-sm bg-selected text-(length:--text-micro) font-semibold text-bad">
                {companyInitials(selectedCompany.name)}
              </span>
            ) : null}
            <span className="truncate">{selectedCompany?.name ?? "Select organization"}</span>
            <ChevronsUpDown className="size-3.5 shrink-0 text-muted-foreground" />
          </Button>
        ) : (
        <Button
          variant="ghost"
          className="w-full justify-between px-2 py-1.5 h-auto text-left"
        >
          <div className="flex items-center gap-2 min-w-0">
            {selectedCompany && (
              <span className={`h-2 w-2 rounded-full shrink-0 ${statusDotColor(selectedCompany.status)}`} />
            )}
            <span className="text-sm font-medium truncate">
              {selectedCompany?.name ?? "Select organization"}
            </span>
          </div>
          <ChevronsUpDown className="h-3.5 w-3.5 shrink-0 text-muted-foreground" />
        </Button>
        )}
      </DropdownMenuTrigger>
      <DropdownMenuContent align="start" className="w-(--sz-220px)">
        <DropdownMenuLabel>Organizations</DropdownMenuLabel>
        <DropdownMenuSeparator />
        {sidebarCompanies.map((company) => (
          <DropdownMenuItem
            key={company.id}
            onClick={() => setSelectedCompanyId(company.id)}
            className={company.id === selectedCompany?.id ? "bg-accent" : ""}
          >
            <span className={`h-2 w-2 rounded-full shrink-0 mr-2 ${statusDotColor(company.status)}`} />
            <span className="truncate">{company.name}</span>
          </DropdownMenuItem>
        ))}
        {sidebarCompanies.length === 0 && (
          // "No companies" is a claim about the account, and after a failed list
          // request it is one we cannot make — say what actually happened and
          // give the customer the way out, since nothing else in the app does.
          companyListUnavailable ? (
            <>
              <DropdownMenuItem disabled>Couldn't load organizations</DropdownMenuItem>
              <DropdownMenuItem
                onSelect={(event) => {
                  // Keep the menu open so the result of the retry is visible.
                  event.preventDefault();
                  void retryCompanies?.();
                }}
              >
                <RefreshCw className="h-4 w-4 mr-2" />
                Try again
              </DropdownMenuItem>
            </>
          ) : (
            <DropdownMenuItem disabled>No organizations</DropdownMenuItem>
          )
        )}
        <DropdownMenuSeparator />
        <DropdownMenuItem asChild>
          <Link to="/company/settings" className="no-underline text-inherit">
            <Settings className="h-4 w-4 mr-2" />
            Settings
          </Link>
        </DropdownMenuItem>
        <DropdownMenuItem asChild>
          <Link to="/companies" className="no-underline text-inherit">
            <Plus className="h-4 w-4 mr-2" />
            Manage Organizations
          </Link>
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
