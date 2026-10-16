"""Rebuild the saved claim page so its Telerik controls start: the scripts the site loaded during
partial page updates were saved in <head>, ahead of the ASP.NET AJAX library they need."""
import sys, pathlib
src_path, out_path, drop = pathlib.Path(sys.argv[1]), pathlib.Path(sys.argv[2]), sys.argv[3:]
lines = src_path.read_text(encoding="utf-8").split("\n")
first = next(i for i, l in enumerate(lines) if 'class="Telerik_stylesheet"' in l and "ScriptResource.axd" in l)
end = next(i for i in range(first, len(lines)) if lines[i].startswith("</script></head>"))
block = lines[first:end] + ["</script>"]
for name in drop:
    tag = f'<script type="text/javascript" src="./ATD ProRewards - Submit Claim_files/{name}"></script>'
    block = [l.replace(tag, "") for l in block]
rest = lines[:first] + [lines[end][len("</script>"):]] + lines[end + 1:]
body_end = max(i for i, l in enumerate(rest) if "</body>" in l)
out = rest[:body_end] + ["<!-- moved here from <head> -->"] + block + rest[body_end:]
out_path.write_text("\n".join(out), encoding="utf-8")
print("moved", len(block), "lines; </body> at", body_end)
