document.addEventListener("change", event => {
  if (event.target.id === "mutagen-target-rarity" || event.target.id === "mutagen-secret" || event.target.id === "mutagen-level") updateMutagenPage();
  if (event.target.id === "weather-target-rarity" || event.target.id === "weather-secret") updateWeatherDropPage();
  if (event.target.id === "luckybox-select") { s.luckyBoxId = event.target.value; go("luckybox"); }
  if (event.target.id === "luckybox-rarity") { s.luckyBoxRarity = event.target.value; updateLuckyBoxPage(); }
});
document.addEventListener("input", event => {
  if (event.target.id === "mutagen-level") updateMutagenPage();
  if (event.target.id === "luckybox-search") { s.luckyBoxSearch = event.target.value; updateLuckyBoxPage(); }
});
