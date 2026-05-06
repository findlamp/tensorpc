import { useState, type ReactNode } from "react";
import MuiMenu from "@mui/material/Menu";
import MuiMenuItem from "@mui/material/MenuItem";
import { useFlexStyles } from "../../hooks/useFlexStyles";

export function MenuListContent({
  props,
  children,
}: {
  props: Record<string, unknown>;
  layout: Record<string, unknown>;
  children: ReactNode[];
}) {
  const sx = useFlexStyles(props);
  const menuItems = props.menuItems as Array<{ id: string; label?: string }> | undefined;
  const [anchorEl, setAnchorEl] = useState<HTMLElement | null>(null);

  return (
    <div style={sx}>
      <div onClick={(e) => setAnchorEl(e.currentTarget)} style={{ cursor: "pointer", display: "inline-block" }}>
        {children}
      </div>
      <MuiMenu anchorEl={anchorEl} open={Boolean(anchorEl)} onClose={() => setAnchorEl(null)}>
        {menuItems?.map((item) => (
          <MuiMenuItem key={item.id} onClick={() => setAnchorEl(null)}>
            {item.label ?? item.id}
          </MuiMenuItem>
        ))}
      </MuiMenu>
    </div>
  );
}
