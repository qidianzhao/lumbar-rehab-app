import React, { useMemo } from 'react';
import { View } from 'react-native';
import Svg, { Circle, G, Line, Polygon, Text as SvgText } from 'react-native-svg';

type Props = {
  labels: string[];
  values: number[]; // 0..100
  size?: number;
  stroke?: string;
  fill?: string;
  textColor?: string;
};

function clamp01(n: number): number {
  if (!Number.isFinite(n)) return 0;
  return Math.max(0, Math.min(1, n));
}

export function RadarChart({
  labels,
  values,
  size = 280,
  stroke = '#2f95dc',
  fill = 'rgba(47,149,220,0.25)',
  textColor = '#333',
}: Props) {
  const { points, axes, rings } = useMemo(() => {
    const n = Math.max(3, labels.length);
    const center = size / 2;
    const radius = size * 0.33;
    const angle0 = -Math.PI / 2;

    const axesPts = Array.from({ length: n }, (_, i) => {
      const a = angle0 + (i * 2 * Math.PI) / n;
      return {
        x: center + Math.cos(a) * radius,
        y: center + Math.sin(a) * radius,
        a,
      };
    });

    const v = Array.from({ length: n }, (_, i) => values[i] ?? 0);
    const polyPts = axesPts
      .map((p, i) => {
        const t = clamp01((v[i] as number) / 100);
        return `${center + Math.cos(p.a) * radius * t},${center + Math.sin(p.a) * radius * t}`;
      })
      .join(' ');

    const ringLevels = [0.25, 0.5, 0.75, 1.0];
    const ringPolys = ringLevels.map((lv) =>
      axesPts
        .map((p) => `${center + Math.cos(p.a) * radius * lv},${center + Math.sin(p.a) * radius * lv}`)
        .join(' '),
    );

    return {
      points: polyPts,
      axes: axesPts,
      rings: ringPolys,
      center,
      radius,
    };
  }, [labels.length, size, values]);

  const n = Math.max(3, labels.length);
  const center = size / 2;

  return (
    <View style={{ width: size, height: size }}>
      <Svg width={size} height={size}>
        <G>
          {rings.map((poly, idx) => (
            <Polygon
              key={idx}
              points={poly}
              fill="none"
              stroke="rgba(0,0,0,0.12)"
              strokeWidth={1}
            />
          ))}
          {axes.slice(0, n).map((p, idx) => (
            <Line
              key={idx}
              x1={center}
              y1={center}
              x2={p.x}
              y2={p.y}
              stroke="rgba(0,0,0,0.18)"
              strokeWidth={1}
            />
          ))}

          <Polygon points={points} fill={fill} stroke={stroke} strokeWidth={2} />
          <Circle cx={center} cy={center} r={2.5} fill={stroke} />

          {axes.slice(0, n).map((p, idx) => {
            const label = labels[idx] ?? '';
            const dx = p.x > center ? 6 : p.x < center ? -6 : 0;
            const dy = p.y > center ? 14 : -6;
            const anchor = p.x > center ? 'start' : p.x < center ? 'end' : 'middle';
            return (
              <SvgText
                key={idx}
                x={p.x + dx}
                y={p.y + dy}
                fontSize={12}
                fill={textColor}
                textAnchor={anchor}
              >
                {label}
              </SvgText>
            );
          })}
        </G>
      </Svg>
    </View>
  );
}

