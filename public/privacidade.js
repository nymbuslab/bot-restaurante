// Identidade da empresa específica da Política (preâmbulo, DPO, assinatura).
// Reaproveita o mesmo fetch do footer.js via gancho onPlataformaData.
window.onPlataformaData = function (d, limpo) {
  if (d.razaoSocial) document.getElementById("p-razao").textContent = limpo(d.razaoSocial);
  if (d.cnpj) document.getElementById("p-cnpj-frase").textContent = ", inscrita no CNPJ sob o nº " + limpo(d.cnpj);
  if (d.endereco) document.getElementById("p-endereco-frase").textContent = ", com sede em " + limpo(d.endereco);
  var assina = "<strong>" + limpo(d.razaoSocial || d.nomeFantasia || "Nymbus Lab") + "</strong>";
  if (d.cnpj) assina += "<br>CNPJ: " + limpo(d.cnpj);
  if (d.endereco) assina += "<br>" + limpo(d.endereco);
  document.getElementById("p-assinatura").innerHTML = assina;
  // Canais de contato do Encarregado (se houver telefone/endereço cadastrados)
  var contato = "";
  if (d.telefone) contato += '<p><strong>Telefone/WhatsApp:</strong> ' + limpo(d.telefone) + '</p>';
  if (d.endereco) contato += '<p><strong>Endereço:</strong> ' + limpo(d.endereco) + '</p>';
  if (contato) document.getElementById("p-contato").innerHTML = contato;
};
