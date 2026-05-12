import { Pipe, PipeTransform } from '@angular/core';

@Pipe({ name: 'fmtNum', standalone: true })
export class FmtNumPipe implements PipeTransform {
  transform(n: number | null | undefined): string {
    return (n == null || isNaN(n) ? 0 : n).toLocaleString('en-US');
  }
}

@Pipe({ name: 'fmtDollar', standalone: true })
export class FmtDollarPipe implements PipeTransform {
  transform(n: number | null | undefined): string {
    let v = n ?? 0;
    const sign = v < 0 ? '-' : '';
    v = Math.abs(v);
    if (v >= 1e6) return `${sign}$${(v / 1e6).toFixed(1)}M`;
    if (v >= 1e3) return `${sign}$${(v / 1e3).toFixed(1)}K`;
    return `${sign}$${v.toFixed(0)}`;
  }
}

@Pipe({ name: 'fmtPct', standalone: true })
export class FmtPctPipe implements PipeTransform {
  transform(n: number | null | undefined): string {
    return `${(n ?? 0).toFixed(1)}%`;
  }
}
