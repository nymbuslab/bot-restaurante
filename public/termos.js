// Identidade da empresa específica dos Termos (preâmbulo, assinatura, contato).
// Reaproveita o mesmo fetch do footer.js via gancho onPlataformaData.
window.onPlataformaData = function (d, limpo) {
  if (d.razaoSocial) document.getElementById("t-razao").textContent = limpo(d.razaoSocial);
  if (d.cnpj) document.getElementById("t-cnpj-frase").textContent = ", inscrita no CNPJ sob o nº " + limpo(d.cnpj);
  if (d.endereco) document.getElementById("t-endereco-frase").textContent = ", com sede em " + limpo(d.endereco);
  var assina = "<strong>" + limpo(d.razaoSocial || d.nomeFantasia || "Nymbus Lab") + "</strong>";
  if (d.cnpj) assina += "<br>CNPJ: " + limpo(d.cnpj);
  if (d.endereco) assina += "<br>" + limpo(d.endereco);
  document.getElementById("t-assinatura").innerHTML = assina;
  var contato = "";
  if (d.telefone) contato += '<p><strong>Telefone/WhatsApp:</strong> ' + limpo(d.telefone) + '</p>';
  if (d.endereco) contato += '<p><strong>Endereço:</strong> ' + limpo(d.endereco) + '</p>';
  document.getElementById("t-contato").innerHTML = contato;
};
