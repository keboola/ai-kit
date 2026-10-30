// OCR privacy gate for clips and screenshots (PRDCT-616): prints every text line Vision reads
// that holds an e-mail address, or an "@" when run with --at, plus any extra terms you pass.
//
//   swiftc -O ocr-scan.swift -o /tmp/ocr-scan            # once
//   ffmpeg -i clip.mp4 -fps_mode passthrough f/%04d.png  # every frame, then add the poster
//   /tmp/ocr-scan f/ [--at] [term ...]                   # exit 1 when anything matched
//
// Icons are often read as "@" (a target icon, a gift icon), which is why --at is opt-in.
// Written 2026-10-09: a MutationObserver scrub lagged a fresh render by about a tenth of a
// second, long enough for the Apps list's "Last edited" e-mail to reach a raw frame.
import AppKit
import Foundation
import Vision

let args = Array(CommandLine.arguments.dropFirst())
guard let dir = args.first else { print("usage: ocr-scan <dir> [--at] [term ...]"); exit(2) }
let at = args.contains("--at")
let terms = args.dropFirst().filter { $0 != "--at" }.map { $0.lowercased() }
let email = try NSRegularExpression(pattern: "[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\\.[A-Za-z]{2,}")
let files = try FileManager.default.contentsOfDirectory(atPath: dir)
  .filter { $0.hasSuffix(".png") || $0.hasSuffix(".jpg") }.sorted()
var hits = 0
for f in files {
  let url = URL(fileURLWithPath: dir).appendingPathComponent(f)
  guard let img = NSImage(contentsOf: url),
    let cg = img.cgImage(forProposedRect: nil, context: nil, hints: nil)
  else { continue }
  let req = VNRecognizeTextRequest()
  req.recognitionLevel = .accurate
  req.usesLanguageCorrection = false
  try VNImageRequestHandler(cgImage: cg, options: [:]).perform([req])
  for obs in req.results ?? [] {
    guard let t = obs.topCandidates(1).first?.string else { continue }
    let low = t.lowercased()
    let isEmail = email.firstMatch(in: t, range: NSRange(t.startIndex..., in: t)) != nil
    if isEmail || (at && t.contains("@")) || terms.contains(where: { low.contains($0) }) {
      print("\(f)\t\(isEmail ? "EMAIL" : "match")\t\(t)")
      hits += 1
    }
  }
}
print("images: \(files.count), hits: \(hits)")
exit(hits > 0 ? 1 : 0)
