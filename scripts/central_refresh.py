"""Download the documented MOJ OpenAPI ZIPs, retaining exact XML and schema.

Official endpoint reference: https://law.moj.gov.tw/api/swagger/index.html
Cache filenames remain compatible with historical sendlaw snapshots; raw bytes
are never rewritten. Provenance records the actual endpoint, schema and digest.
"""
from pathlib import Path
from datetime import datetime, timezone
import hashlib
import io
import json
import zipfile
import xml.etree.ElementTree as ET
from official_fetch import download, atomic_write

BULK = [('laws', 'CF', 'FalV.xml', 'law', 'ChLaw.xml'),
        ('orders', 'CM', 'MingLing.xml', 'order', 'ChOrder.xml')]


def refresh_bulk(cache, *, fetch=download):
    pending = []
    for label, key, filename, endpoint, member in BULK:
        url = f'https://law.moj.gov.tw/api/ch/{endpoint}/xml'
        raw = fetch(url, timeout=60)
        observed = datetime.now(timezone.utc).isoformat(timespec='seconds')
        with zipfile.ZipFile(io.BytesIO(raw)) as archive:
            if archive.namelist().count(member) != 1 or archive.namelist().count('schema.csv') != 1:
                raise ValueError(f'Official {key} archive must contain exactly one {member} and schema.csv')
            xml = archive.read(member)
            schema = archive.read('schema.csv')
        root = ET.fromstring(xml)
        if root.tag != 'Laws' or not root.attrib.get('UpdateDate') or not root.findall('Law'):
            raise ValueError(f'Official {key} XML has no recognized snapshot or law records')
        metadata = {'url': url, 'format': 'xml', 'sha256': hashlib.sha256(xml).hexdigest(),
                    'hashScope': 'downloaded-xml-file', 'observedAt': observed,
                    'snapshot': root.attrib['UpdateDate'], 'schema': 'moj-openapi-v1',
                    'archiveSha256': hashlib.sha256(raw).hexdigest(),
                    'schemaSha256': hashlib.sha256(schema).hexdigest(), 'archiveMember': member}
        pending.append((label, filename, raw, xml, schema, metadata))
    # Both responses must be well-formed before replacing the cache baseline.
    for label, filename, raw, xml, schema, metadata in pending:
        atomic_write(Path(cache) / (label + '.zip'), raw)
        atomic_write(Path(cache) / label / filename, xml)
        atomic_write(Path(cache) / label / 'schema.csv', schema)
        atomic_write(Path(cache) / label / 'source.json', (json.dumps(metadata, indent=2)+'\n').encode())



def scalar(element, name):
    fields = element.findall(name)
    if len(fields) != 1 or len(fields[0]):
        raise ValueError('Missing/duplicate/structured official XML field: ' + name)
    return fields[0].text or ''


def read_bulk(path):
    """Adapt field names in memory, preserving original source text verbatim."""
    root = ET.parse(path).getroot()
    if root.tag != 'Laws':
        if not root.findall('法規'):
            raise ValueError('Unrecognized official XML format')
        return root  # Historical sendlaw cache used by audited source tools.
    adapted = ET.Element('法規資料', root.attrib)
    mapping = {'LawLevel':'法規性質', 'LawName':'法規名稱', 'LawURL':'法規網址',
               'LawModifiedDate':'最新異動日期', 'LawEffectiveDate':'生效日期',
               'LawEffectiveNote':'生效內容', 'LawAbandonNote':'廢止註記',
               'LawHistories':'沿革內容', 'LawForeword':'前言'}
    for law in root:
        if law.tag != 'Law':
            raise ValueError('Unexpected element in official Laws XML: ' + law.tag)
        item = ET.SubElement(adapted, '法規')
        for source, target in mapping.items():
            ET.SubElement(item, target).text = scalar(law, source)
        groups = law.findall('LawArticles')
        articles = groups[0] if len(groups) == 1 else None
        if articles is None:
            raise ValueError('Missing official LawArticles')
        content = ET.SubElement(item, '法規內容')
        for article in articles:
            if article.tag != 'Article':
                raise ValueError('Unknown official article element')
            kind = scalar(article, 'ArticleType').strip()
            number = scalar(article, 'ArticleNo')
            # The live XML spells this ArticleConctent, unlike schema.csv.
            texts = article.findall('ArticleConctent') + article.findall('ArticleContent')
            if len(texts) != 1 or len(texts[0]):
                raise ValueError('Missing/ambiguous/structured official article text')
            text = texts[0].text or ''
            if kind == 'C':
                ET.SubElement(content,'編章節').text = text
            elif kind == 'A':
                row = ET.SubElement(content,'條文')
                ET.SubElement(row,'條號').text = number
                ET.SubElement(row,'條文內容').text = text
            else:
                raise ValueError('Unknown official article type: ' + kind)
        groups = law.findall('LawAttachements')
        attachments = groups[0] if len(groups) == 1 else None
        if attachments is None:
            raise ValueError('Missing official attachment list')
        files = ET.SubElement(item,'附件')
        for attachment in attachments:
            if attachment.tag != 'File' or attachment.find('FileName') is None or attachment.find('FileURL') is None:
                raise ValueError('Unknown official attachment format')
            file = ET.SubElement(files,'檔案')
            ET.SubElement(file,'檔案名稱').text = scalar(attachment, 'FileName')
            ET.SubElement(file,'下載網址').text = scalar(attachment, 'FileURL')
    return adapted
