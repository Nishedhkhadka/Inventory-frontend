import React from "react";

export function CurrencyRupeeNepaleseIcon({
  size = 14,
  color = "currentColor",
  strokeWidth = 1.8,
  background = "transparent",
  opacity = 1,
  rotation = 0,
  shadow = 0,
  flipHorizontal = false,
  flipVertical = false,
  padding = 0,
}) {
  const transforms = [];
  if (rotation !== 0) transforms.push(`rotate(${rotation}deg)`);
  if (flipHorizontal) transforms.push("scaleX(-1)");
  if (flipVertical) transforms.push("scaleY(-1)");

  const viewBoxSize = 24 + padding * 2;
  const viewBoxOffset = -padding;
  const viewBox = `${viewBoxOffset} ${viewBoxOffset} ${viewBoxSize} ${viewBoxSize}`;

  const svgProps = {
    xmlns: "http://www.w3.org/2000/svg",
    viewBox,
    width: size,
    height: size,
    fill: "none",
    stroke: color,
    strokeWidth,
    strokeLinecap: "round",
    strokeLinejoin: "round",
    style: {
      opacity,
      transform: transforms.join(" ") || undefined,
      filter:
        shadow > 0
          ? `drop-shadow(0 ${shadow}px ${shadow * 2}px rgba(0,0,0,0.3))`
          : undefined,
      backgroundColor: background !== "transparent" ? background : undefined,
      display: "inline-block",
      verticalAlign: "middle",
    },
    "aria-hidden": true,
    focusable: "false",
  };

  return React.createElement(
    "svg",
    svgProps,
    React.createElement("path", {
      d: "M15 5H4h3a4 4 0 1 1 0 8H4l6 6m11-2-4.586-4.414a2 2 0 0 0-2.828 2.828l.707.707",
    })
  );
}

// Single source of truth for how money is displayed across the app.
// Shows the Nepalese rupee symbol in the same style as the business icon.
export function formatMoney(value) {
  const n = Number(value) || 0;
  return React.createElement(
    "span",
    { className: "inline-flex items-center gap-1 whitespace-nowrap" },
    React.createElement(CurrencyRupeeNepaleseIcon, { size: 12, strokeWidth: 1.8 }),
    React.createElement("span", null, n.toLocaleString(undefined, { maximumFractionDigits: 2 }))
  );
}

// Bare number, no currency label — the symbol is shown by the surrounding
// label when needed.
export function formatNumber(value) {
  return (Number(value) || 0).toLocaleString(undefined, {
    maximumFractionDigits: 2,
  });
}
