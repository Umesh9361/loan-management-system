// Local synthetic verification only; never added to the application's routes.
// Run: node --import tsx tests/borrower-pdf-preview.ts
import { createServer } from 'node:http';
import { readFileSync, mkdirSync, writeFileSync } from 'node:fs';
import vm from 'node:vm';
import ts from 'typescript';
import { build } from 'esbuild';
import { formatWeight, loanWeightTotals, weightGrams } from '../shared/report-weights';

const source = readFileSync('client/src/pages/reports/borrower-list.tsx', 'utf8');
const ast = ts.createSourceFile('borrower-list.tsx', source, ts.ScriptTarget.Latest, true, ts.ScriptKind.TSX);
let generator = '';
function visit(node: ts.Node) {
  if (ts.isVariableDeclaration(node) && node.name.getText(ast) === 'generateReportHTML' && node.initializer) {
    generator = node.initializer.getText(ast);
  }
  ts.forEachChild(node, visit);
}
visit(ast);
if (!generator) throw new Error('Actual report generator not found');
const code = ts.transpileModule(`const generate = ${generator}; generate;`,
  { compilerOptions: { target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.None } }).outputText;
const modes = ['date-wise', 'name-wise', 'closing-wise', 'maturity-wise'];
const fixtures: Record<string, string> = {};
for (const mode of modes) {
  for (const count of [5, 69, 550]) {
    const loans = Array.from({ length: count }, (_, i) => ({
      id: `synthetic-${i}`, accountNumber: `${600 + i}`, principalAmount: 10000 + i * 100,
      borrowerName: i % 8 === 0
        ? 'दीर्घ नावाची चाचणी श्रीमती कृत्रिम कर्जदार आडनाव'
        : 'कृत्रिम कर्जदार चाचणी',
      loanDate: '2026-10-01', actualMaturityDate: '2027-10-01',
      weight: '7.083', metalType: i % 3 === 0 ? 'silver' : 'gold',
      loanType: 'तारण', status: mode === 'closing-wise' ? 'closed' : 'active',
      itemDescription: i % 9 === 0 ? 'सोन्याची अंगठी व साखळी, लांब मजकुराची चाचणी' : 'दागिने',
    }));
    const generate = vm.runInNewContext(code, {
      activeTab: mode, dateWiseStatus: 'all', nameWiseStatus: 'all',
      showInterestRate: true,
      photoAvailabilityMap: new Map(), company: { companyName: 'कृत्रिम चाचणी संस्था' },
      dateFrom: '2026-04-01', dateTo: '2026-10-24',
      loanClosures: loans.map(loan => ({ loanId: loan.id, closureDate: '2026-10-24', interestPaid: '1200' })),
      formatWeight, weightGrams, loanWeightTotals,
    });
    fixtures[`${mode}-${count}`] = generate(loans, 'चाचणी गट');
  }
}
const bundle = await build({
  stdin: { resolveDir: process.cwd(), loader: 'ts', contents: `
    import { createBorrowerListPdf, borrowerPrintCss, BORROWER_PDF_PAGE } from './client/src/lib/borrower-list-pdf';
    window.runPdf = async () => {
      const pdf = await createBorrowerListPdf(window.fixtureHtml);
      await fetch('/result?mode=' + window.fixtureMode + '&rows=' + window.fixtureRows,
        {method: 'POST', body: pdf.output('arraybuffer')});
      return { pages: pdf.getNumberOfPages(), framesLeft: document.querySelectorAll('iframe').length };
    };
    for(const style of Array.from(document.querySelectorAll('style'))) {
      const extra = document.createElement('style');
      extra.textContent = borrowerPrintCss(style.sheet.cssRules, q => matchMedia(q).matches);
      document.head.append(extra);
    }
    const contentWidth = (BORROWER_PDF_PAGE.width - BORROWER_PDF_PAGE.left - BORROWER_PDF_PAGE.right) * 96 / 25.4;
    document.documentElement.style.setProperty('width', contentWidth + 'px', 'important');
    document.body.style.setProperty('width', contentWidth + 'px', 'important');
    window.fixtureReady = true;
  ` },
  bundle: true, write: false, platform: 'browser', format: 'iife',
});
createServer(async (req, res) => {
  const url = new URL(req.url || '/', 'http://127.0.0.1');
  if (url.pathname === '/fixture.js') {
    res.setHeader('Content-Type', 'application/javascript');
    return res.end(bundle.outputFiles[0].text);
  }
  const mode = url.searchParams.get('mode') || 'date-wise';
  if (!modes.includes(mode)) { res.writeHead(400); return res.end(); }
  if (url.pathname === '/result' && req.method === 'POST') {
    const chunks = [];
    for await (const chunk of req) chunks.push(chunk);
    mkdirSync('generated-artifacts/borrower-pdf', { recursive: true });
    const prefix = url.searchParams.get('rows') === '550' ? 'large-'
      : url.searchParams.get('rows') === '5' ? 'short-' : '';
    writeFileSync(`generated-artifacts/borrower-pdf/${prefix}${mode}.pdf`, Buffer.concat(chunks));
    return res.end('ok');
  }
  const requested = Number(url.searchParams.get('rows'));
  const count = requested === 5 || requested === 550 ? requested : 69;
  const html = fixtures[`${mode}-${count}`];
  res.setHeader('Content-Type', 'text/html; charset=utf-8');
  res.end(html.replace(/<script\b[^>]*>[\s\S]*?<\/script>/gi, '').replace('</body>',
    `<script>window.fixtureMode=${JSON.stringify(mode)};window.fixtureRows=${count};window.fixtureHtml=${JSON.stringify(html).replace(/</g, '\\u003c')};</script><script src="/fixture.js"></script></body>`));
}).listen(5001, '0.0.0.0', () => console.log('Synthetic actual borrower print/PDF fixture on :5001'));
