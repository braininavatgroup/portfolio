export function RosterEvidence() {
  return (
    <section className="roster-evidence" aria-labelledby="roster-heading">
      <div>
        <h3 id="roster-heading">Brain in a Vat roster</h3>
        <p>Selected artists and campaign work will appear here once cleared for publication.</p>
      </div>
      <div className="roster-preview" aria-label="Roster material pending">
        {Array.from({ length: 5 }, (_, index) => <span aria-hidden="true" key={index} />)}
        <em>Material pending</em>
      </div>
    </section>
  );
}
