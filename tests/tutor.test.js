import assert from 'node:assert/strict';
import test from 'node:test';
import {
  formatCep,
  formatCpfCnpj,
  formatDataNascimento,
  formatTelefone,
  isCepValido,
  isCpfCnpjValido,
  isDataNascimentoValida,
  isEmailValido,
  isTelefoneValido,
  maskCpfCnpj,
  onlyDigits,
} from '../src/utils/tutor.js';

test('telefone aceita fixo e celular com DDD e rejeita números incompletos', () => {
  assert.equal(formatTelefone('4733330000'), '(47) 3333-0000');
  assert.equal(formatTelefone('47999990001'), '(47) 99999-0001');
  assert.equal(isTelefoneValido('(47) 3333-0000'), true);
  assert.equal(isTelefoneValido('(47) 99999-0001'), true);
  for (const value of ['', '4799999', '479999900012', '00000000000']) {
    assert.equal(isTelefoneValido(value), false, value);
  }
});

test('CPF/CNPJ alterna a máscara e mantém os dígitos para persistência', () => {
  assert.equal(formatCpfCnpj('12345678909'), '123.456.789-09');
  assert.equal(formatCpfCnpj('11222333000181'), '11.222.333/0001-81');
  assert.equal(onlyDigits(formatCpfCnpj('11222333000181')), '11222333000181');
  assert.equal(maskCpfCnpj('12345678909'), '***.***.***-**');
  assert.equal(maskCpfCnpj('11222333000181'), '**.***.***/****-**');
  assert.equal(maskCpfCnpj(''), '');
});

test('CPF valida ambos os dígitos verificadores e rejeita sequências repetidas', () => {
  for (const value of ['123.456.789-09', '52998224725']) {
    assert.equal(isCpfCnpjValido(value), true, value);
  }
  for (const value of [
    '12345678900',
    '12345678919',
    '11111111111',
    '1234567890',
  ]) {
    assert.equal(isCpfCnpjValido(value), false, value);
  }
});

test('CNPJ valida ambos os dígitos verificadores e rejeita sequências repetidas', () => {
  assert.equal(isCpfCnpjValido('11.222.333/0001-81'), true);
  for (const value of ['11222333000180', '11222333000191', '00000000000000']) {
    assert.equal(isCpfCnpjValido(value), false, value);
  }
});

test('e-mail aceita tags e subdomínios e rejeita domínios malformados', () => {
  for (const value of ['ana@example.com', 'ana+pet@alunos.example.com.br']) {
    assert.equal(isEmailValido(value), true, value);
  }
  for (const value of [
    'ana@',
    'ana@example..com',
    'ana@-example.com',
    'ana@exa_mple.com',
    'ana@example-.com',
    'ana exemplo@example.com',
    '.ana@example.com',
    'ana..pet@example.com',
  ]) {
    assert.equal(isEmailValido(value), false, value);
  }
});

test('CEP exige oito dígitos e pode ser normalizado após aplicar a máscara', () => {
  assert.equal(formatCep('89200000'), '89200-000');
  assert.equal(isCepValido('89200-000'), true);
  assert.equal(isCepValido('89200-00'), false);
  assert.equal(isCepValido('892000000'), false);
  assert.equal(onlyDigits(formatCep('89200000')), '89200000');
});

test('nascimento rejeita datas futuras e impossíveis, incluindo anos bissextos', () => {
  const hoje = '2026-10-20';
  assert.equal(isDataNascimentoValida('2026-10-20', hoje), true);
  assert.equal(isDataNascimentoValida('2026-10-21', hoje), false);
  assert.equal(isDataNascimentoValida('2000-02-29', hoje), true);
  assert.equal(isDataNascimentoValida('1900-02-29', hoje), false);
  assert.equal(isDataNascimentoValida('2025-02-29', hoje), false);
  assert.equal(isDataNascimentoValida('2026-04-31', hoje), false);
  assert.equal(formatDataNascimento('1990-05-15'), '15/05/1990');
});
