# Contract: Test Report Parsers

## Parser Interface

Each parser is a bash function with signature:

```bash
parse_<framework>_report <report_file_or_output>
# Returns: "<passed> <failed> <total>" (space-separated integers)
# Returns: "0 0 0" on parse failure
```

## Parser Specifications

### 1. Vitest / Jest Parser (`parse_vitest_report`)

**Input**: JSON file from `--reporter=json --outputFile=<path>`

**jq extraction**:
```bash
passed=$(jq '[.testResults[]?.assertionResults[]? | select(.status == "passed")] | length' "$file")
failed=$(jq '[.testResults[]?.assertionResults[]? | select(.status == "failed")] | length' "$file")
```

**Notes**: Jest and Vitest share the same JSON schema for `testResults[].assertionResults[]`.

### 2. Playwright Parser (`parse_playwright_report`)

**Input**: JSON from `--reporter=json` (stdout redirect)

**jq extraction**:
```bash
passed=$(jq '[.. | .specs? // empty | .[]? | .tests[]? | select(.status == "expected")] | length' "$file")
failed=$(jq '[.. | .specs? // empty | .[]? | .tests[]? | select(.status == "unexpected")] | length' "$file")
```

### 3. Pytest Parser (`parse_pytest_report`)

**Input**: Text output from `pytest --tb=short -q`

**Regex extraction**:
```bash
# Last line format: "X passed, Y failed" or "X passed" or "Y failed"
passed=$(grep -oP '\d+(?= passed)' <<< "$output" || echo 0)
failed=$(grep -oP '\d+(?= failed)' <<< "$output" || echo 0)
```

**Alternative**: If JUnit XML available (`--junitxml=<path>`):
```bash
passed=$(xmllint --xpath 'string(//testsuite/@tests)' "$file") - $(xmllint --xpath 'string(//testsuite/@failures)' "$file")
failed=$(xmllint --xpath 'string(//testsuite/@failures)' "$file")
```

### 4. Cargo Test Parser (`parse_cargo_report`)

**Input**: Text output from `cargo test`

**Regex extraction**:
```bash
# Line format: "test result: ok. X passed; Y failed; Z ignored"
passed=$(grep -oP '\d+(?= passed)' <<< "$output" || echo 0)
failed=$(grep -oP '\d+(?= failed)' <<< "$output" || echo 0)
```

### 5. Go Test Parser (`parse_go_report`)

**Input**: JSON output from `go test -json ./...`

**jq extraction**:
```bash
# Each line is a JSON object with Action field
passed=$(grep '"Action":"pass"' "$file" | grep -c '"Test":' || echo 0)
failed=$(grep '"Action":"fail"' "$file" | grep -c '"Test":' || echo 0)
```

### 6. RSpec Parser (`parse_rspec_report`)

**Input**: JSON file from `--format json --out <path>`

**jq extraction**:
```bash
passed=$(jq '[.examples[] | select(.status == "passed")] | length' "$file")
failed=$(jq '[.examples[] | select(.status == "failed")] | length' "$file")
```

### 7. Exit-Code Fallback Parser (`parse_exitcode_report`)

**Used when**: `testing.framework` is unrecognized or not set

**Logic**:
```bash
if [ $exit_code -eq 0 ]; then
  echo "1 0 1"   # 1 passed, 0 failed
else
  echo "0 1 1"   # 0 passed, 1 failed
fi
```

## Parser Selection

```bash
case "$FRAMEWORK" in
  vitest|jest)     parse_vitest_report "$REPORT_FILE" ;;
  playwright)      parse_playwright_report "$REPORT_FILE" ;;
  pytest)          parse_pytest_report "$OUTPUT" ;;
  cargo-test)      parse_cargo_report "$OUTPUT" ;;
  go-test)         parse_go_report "$REPORT_FILE" ;;
  rspec)           parse_rspec_report "$REPORT_FILE" ;;
  phpunit)         parse_junit_xml "$REPORT_FILE" ;;
  *)               parse_exitcode_report "$EXIT_CODE" ;;
esac
```
