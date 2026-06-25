import 'react-native-get-random-values';
import { Buffer } from 'buffer';
global.Buffer = Buffer;
import { EventEmitter } from 'events';
global.EventEmitter = EventEmitter;

import { StatusBar } from 'expo-status-bar';
import { StyleSheet, Text, View, ScrollView, TouchableOpacity, TextInput } from 'react-native';
import { useState, useEffect } from 'react';

import PouchDB from 'pouchdb-core';
import HttpPouch from 'pouchdb-adapter-http';

PouchDB.plugin(HttpPouch);

// Conexión a la IP de la computadora en la red local
const REMOTE_URL = 'http://admin:password@192.168.100.180:5984/axon';

// Singleton DB instance connected directly to CouchDB
const localDB = new PouchDB(REMOTE_URL);

// Componente para editar los bloques de la página
function PageEditor({ page, onBack }: { page: any, onBack: () => void }) {
  const [blocks, setBlocks] = useState<any[]>([]);
  const docId = `axon-blocks-${page.id}`;
  
  useEffect(() => {
    let active = true;

    const loadBlocks = async () => {
      try {
        const doc = await localDB.get(docId);
        if (active) {
          setBlocks((doc as any).data);
        }
      } catch (err: any) {
        if (err.name === 'not_found' && active) {
          // Documento aún no existe localmente
        }
      }
    };
    loadBlocks();

    const changes = localDB.changes({
      since: 'now',
      live: true,
      include_docs: true,
      doc_ids: [docId]
    }).on('change', (change) => {
      if (active) {
        setBlocks((change.doc as any).data);
      }
    });

    return () => {
      active = false;
      changes.cancel();
    };
  }, [page.id]);

  const updateBlockContent = async (id: string, text: string) => {
    // Actualización optimista en la UI
    const newBlocks = blocks.map(b => b.id === id ? { ...b, content: text } : b);
    setBlocks(newBlocks);
    
    // Guardado real en PouchDB
    try {
      const currentDoc = await localDB.get(docId).catch(() => null);
      if (currentDoc) {
        await localDB.put({ ...currentDoc, data: newBlocks });
      } else {
        await localDB.put({ _id: docId, data: newBlocks });
      }
    } catch (err) {
      console.error('Error guardando bloque:', err);
    }
  };

  return (
    <View style={styles.editorContainer}>
      <View style={styles.header}>
        <TouchableOpacity onPress={onBack}>
          <Text style={styles.backButton}>← Volver</Text>
        </TouchableOpacity>
        <Text style={styles.headerTitle} numberOfLines={1}>{page.title}</Text>
      </View>
      
      <ScrollView style={styles.blocksList} keyboardShouldPersistTaps="handled">
        <Text style={styles.pageIconBig}>{page.icon}</Text>
        <Text style={styles.pageTitleBig}>{page.title}</Text>
        
        {blocks.map((block) => (
          <View key={block.id} style={styles.blockRow}>
            {block.type === 'checkbox' && (
              <View style={[styles.checkbox, block.checked && styles.checkboxChecked]} />
            )}
            {block.type === 'bullet' && <Text style={styles.bullet}>•</Text>}
            <TextInput
              style={[
                styles.blockInput,
                block.type === 'h1' && styles.h1,
                block.type === 'h2' && styles.h2,
                block.type === 'h3' && styles.h3,
                block.type === 'checkbox' && block.checked && styles.textChecked
              ]}
              value={block.content}
              onChangeText={(text) => updateBlockContent(block.id, text)}
              multiline
              placeholder={block.type === 'paragraph' ? "Escribe algo..." : ""}
              placeholderTextColor="#ccc"
            />
          </View>
        ))}
        {blocks.length === 0 && (
          <Text style={{color: '#999', marginTop: 20}}>Página vacía o cargando bloques...</Text>
        )}
      </ScrollView>
    </View>
  );
}

export default function App() {
  const [pages, setPages] = useState<any[]>([]);
  const [syncStatus, setSyncStatus] = useState('Conectado');
  const [selectedPage, setSelectedPage] = useState<any>(null);

  useEffect(() => {
    let active = true;

    const loadPages = async () => {
      try {
        const doc = await localDB.get('axon-pages');
        if (active) setPages((doc as any).data);
      } catch (err: any) {
        if (active && err.name !== 'not_found') {
          console.error(err);
        }
      }
    };

    loadPages();

    // Suscribirse a los cambios
    const changes = localDB.changes({
      since: 'now',
      live: true,
      include_docs: true,
      doc_ids: ['axon-pages']
    }).on('change', (change) => {
      if (active) {
        setPages((change.doc as any).data);
      }
    });

    return () => {
      active = false;
      changes.cancel();
    };
  }, []);

  if (selectedPage) {
    return (
      <View style={{ flex: 1 }}>
        <StatusBar style="dark" />
        <PageEditor page={selectedPage} onBack={() => setSelectedPage(null)} />
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <Text style={styles.title}>Axon Mobile</Text>
      <Text style={styles.status}>Estado: {syncStatus}</Text>
      
      <ScrollView style={styles.list}>
        <Text style={styles.subtitle}>Tus Páginas:</Text>
        {pages.map((page, i) => (
          <TouchableOpacity key={i} style={styles.card} onPress={() => setSelectedPage(page)}>
            <Text style={styles.cardIcon}>{page.icon}</Text>
            <Text style={styles.cardTitle}>{page.title}</Text>
          </TouchableOpacity>
        ))}
        {pages.length === 0 && (
          <Text style={{color: '#999', marginTop: 20}}>No hay páginas o descargando...</Text>
        )}
      </ScrollView>

      <StatusBar style="auto" />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f5f5f5',
    paddingTop: 80,
    paddingHorizontal: 20,
  },
  title: {
    fontSize: 28,
    fontWeight: 'bold',
  },
  status: {
    fontSize: 14,
    color: '#666',
    marginTop: 8,
    marginBottom: 30,
  },
  subtitle: {
    fontSize: 18,
    fontWeight: '600',
    marginBottom: 16,
  },
  list: {
    flex: 1,
  },
  card: {
    backgroundColor: 'white',
    padding: 20,
    borderRadius: 12,
    marginBottom: 12,
    flexDirection: 'row',
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 5,
    elevation: 2,
  },
  cardIcon: {
    fontSize: 24,
    marginRight: 16,
  },
  cardTitle: {
    fontSize: 18,
    fontWeight: '500',
  },
  
  // Estilos del Editor
  editorContainer: {
    flex: 1,
    backgroundColor: '#fff',
    paddingTop: 50,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingBottom: 15,
    borderBottomWidth: 1,
    borderBottomColor: '#f0f0f0',
  },
  backButton: {
    fontSize: 16,
    color: '#4F46E5', // Azul Índigo de la marca
    fontWeight: '600',
    marginRight: 16,
  },
  headerTitle: {
    fontSize: 16,
    fontWeight: '500',
    color: '#333',
    flex: 1,
  },
  blocksList: {
    flex: 1,
    padding: 24,
  },
  pageIconBig: {
    fontSize: 64,
    marginBottom: 16,
  },
  pageTitleBig: {
    fontSize: 32,
    fontWeight: 'bold',
    marginBottom: 24,
    color: '#111',
  },
  blockRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    marginBottom: 8,
  },
  blockInput: {
    flex: 1,
    fontSize: 16,
    color: '#333',
    lineHeight: 24,
    padding: 0, // Remover padding por defecto en Android
  },
  h1: {
    fontSize: 28,
    fontWeight: 'bold',
    marginTop: 16,
    marginBottom: 8,
  },
  h2: {
    fontSize: 24,
    fontWeight: 'bold',
    marginTop: 12,
    marginBottom: 6,
  },
  h3: {
    fontSize: 20,
    fontWeight: '600',
    marginTop: 8,
    marginBottom: 4,
  },
  bullet: {
    fontSize: 16,
    marginRight: 10,
    marginTop: 2,
    color: '#333',
  },
  checkbox: {
    width: 20,
    height: 20,
    borderWidth: 2,
    borderColor: '#4F46E5',
    borderRadius: 4,
    marginRight: 10,
    marginTop: 2,
  },
  checkboxChecked: {
    backgroundColor: '#4F46E5',
  },
  textChecked: {
    textDecorationLine: 'line-through',
    color: '#999',
  }
});
