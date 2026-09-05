import "./sales.css";

interface NoAccessBlockProps {
  title: string;
}

// Shared "no access" block reused everywhere a role loses access to a page
// that others can see (e.g. Finance on Fulfillment, Sales Rep on Reports).
export function NoAccessBlock({ title }: NoAccessBlockProps) {
  return (
    <div className="sales-page">
      <div className="sales-header">
        <h1>{title}</h1>
      </div>
      <div className="banner-error">You do not have permission to access this resource.</div>
    </div>
  );
}
