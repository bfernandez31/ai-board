interface ConfusionMatrixProps {
  tp: number;
  fp: number;
  tn: number;
  fn: number;
  precision: number | null;
  recall: number | null;
}

export function ConfusionMatrix({ tp, fp, tn, fn, precision, recall }: ConfusionMatrixProps) {
  return (
    <div className="space-y-2">
      <h3 className="text-sm font-semibold">Friction Confusion Matrix</h3>
      <table className="w-full text-sm border-collapse">
        <thead>
          <tr>
            <th scope="col" className="text-left p-2 text-muted-foreground font-normal"></th>
            <th scope="col" className="text-left p-2 text-muted-foreground font-normal">Actual: low risk</th>
            <th scope="col" className="text-left p-2 text-muted-foreground font-normal">Actual: friction</th>
          </tr>
        </thead>
        <tbody>
          <tr className="border-t">
            <th scope="row" className="text-left p-2 text-muted-foreground font-normal">Predicted: low risk</th>
            <td className="p-2" aria-label={`True positives: ${tp}`}>
              <div className="text-xs text-muted-foreground">True Positive</div>
              <div className="font-mono font-semibold text-base">{tp}</div>
            </td>
            <td className="p-2" aria-label={`False negatives: ${fn}`}>
              <div className="text-xs text-muted-foreground">False Negative</div>
              <div className="font-mono font-semibold text-base">{fn}</div>
            </td>
          </tr>
          <tr className="border-t">
            <th scope="row" className="text-left p-2 text-muted-foreground font-normal">Predicted: friction</th>
            <td className="p-2" aria-label={`False positives: ${fp}`}>
              <div className="text-xs text-muted-foreground">False Positive</div>
              <div className="font-mono font-semibold text-base">{fp}</div>
            </td>
            <td className="p-2" aria-label={`True negatives: ${tn}`}>
              <div className="text-xs text-muted-foreground">True Negative</div>
              <div className="font-mono font-semibold text-base">{tn}</div>
            </td>
          </tr>
          <tr className="border-t">
            <th scope="row" className="text-left p-2 text-muted-foreground font-normal">Precision</th>
            <td className="p-2 font-mono font-semibold" colSpan={2}>
              {precision === null ? '—' : precision.toString()}
            </td>
          </tr>
          <tr className="border-t">
            <th scope="row" className="text-left p-2 text-muted-foreground font-normal">Recall</th>
            <td className="p-2 font-mono font-semibold" colSpan={2}>
              {recall === null ? '—' : recall.toString()}
            </td>
          </tr>
        </tbody>
      </table>
    </div>
  );
}
