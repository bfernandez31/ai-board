interface RangeHitPanelProps {
  title: string;
  data: {
    inRange: number;
    under: number;
    over: number;
    incomparable: number;
  };
}

export function RangeHitPanel({ title, data }: RangeHitPanelProps) {
  return (
    <div className="space-y-2">
      <h3 className="text-sm font-semibold">{title}</h3>
      <table className="w-full text-sm border-collapse">
        <thead>
          <tr>
            <th scope="col" className="text-left p-2 text-muted-foreground font-normal">Result</th>
            <th scope="col" className="text-left p-2 text-muted-foreground font-normal">Count</th>
          </tr>
        </thead>
        <tbody>
          <tr className="border-t">
            <td className="p-2">In-range</td>
            <td className="p-2 font-mono font-semibold">{data.inRange}</td>
          </tr>
          <tr className="border-t">
            <td className="p-2">Under</td>
            <td className="p-2 font-mono font-semibold">{data.under}</td>
          </tr>
          <tr className="border-t">
            <td className="p-2">Over</td>
            <td className="p-2 font-mono font-semibold">{data.over}</td>
          </tr>
          {data.incomparable > 0 && (
            <tr className="border-t">
              <td className="p-2">Incomparable</td>
              <td className="p-2 font-mono font-semibold">{data.incomparable}</td>
            </tr>
          )}
        </tbody>
      </table>
    </div>
  );
}
