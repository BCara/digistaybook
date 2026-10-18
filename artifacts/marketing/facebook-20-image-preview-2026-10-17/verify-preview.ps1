$ErrorActionPreference = 'Stop'
$previewFolder = $PSScriptRoot
$postDrafts = Get-Content -Raw -LiteralPath (Join-Path $previewFolder 'posts.json') | ConvertFrom-Json
$titleMap = @'
{"digital-01-guestbook-phone":"A digital guestbook for your rental","digital-02-leave-memory":"Leave a little memory","digital-03-photos-notes":"Photos. Notes. Little moments.","digital-04-in-your-pocket":"A guestbook in your pocket","digital-05-their-stories":"Your guests. Their stories.","digital-06-next-guests":"Memories for the next guests","digital-07-no-app":"No app. Just a memory.","digital-08-wall-of-memories":"Let every stay add to the story","01-welcome-counter":"A thoughtful welcome","02-melbourne-laneway":"Share your local favourites","03-wifi-connection":"The Wi-Fi question. Answered.","04-evening-arrival":"Make arrival feel easy","05-breakfast-flatlay":"A good morning starts locally","07-room-to-unpack":"Leave room to settle in","08-simple-instructions":"Small details. Clear answers.","09-checkout-keys":"A calmer checkout","10-rainy-day":"Good plans for rainy days","11-melbourne-tram":"A little local knowledge","12-bayside-walk":"Recommend the memorable walk","14-games-night":"The little moments count"}
'@ | ConvertFrom-Json
foreach ($postDraft in $postDrafts) { $postDraft.title = $titleMap.($postDraft.id) }
[IO.File]::WriteAllText((Join-Path $previewFolder 'posts.json'), ($postDrafts | ConvertTo-Json -Depth 10), [Text.UTF8Encoding]::new($false))
$missingImages = @($postDrafts | Where-Object { -not (Test-Path -LiteralPath (Join-Path $previewFolder $_.image)) })
[pscustomobject]@{ Captions=$postDrafts.Count; Images=@(Get-ChildItem -LiteralPath $previewFolder -Filter '*.png').Count; Missing=$missingImages.Count } | ConvertTo-Json
