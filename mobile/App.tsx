import 'react-native-get-random-values';
import { Buffer } from 'buffer';
global.Buffer = Buffer;
import { EventEmitter } from 'events';
global.EventEmitter = EventEmitter;

import { StatusBar } from 'expo-status-bar';
import { StyleSheet, Text, View, ScrollView } from 'react-native';
import { useState, useEffect } from 'react';

import PouchDB from 'pouchdb-core';
import MemoryAdapter from 'pouchdb-adapter-memory';
import HttpPouch from 'pouchdb-adapter-http';
import replication from 'pouchdb-replication';

PouchDB.plugin(MemoryAdapter)
       .plugin(HttpPouch)
       .plugin(replication);

// Conexión a la IP de la computadora en la red local
const REMOTE_URL = 'http://admin:password@192.168.100.180:5984/axon';

export default function App() {
  const [pages, setPages] = useState<any[]>([]);
  const [syncStatus, setSyncStatus] = useState('Iniciando...');

  useEffect(() => {
    let active = true;
    
    // Crear la base local en memoria (para evitar errores nativos en esta fase)
    const localDB = new PouchDB('axon', { adapter: 'memory' });
    const remoteDB = new PouchDB(REMOTE_URL);

    // Iniciar Sincronización
    const sync = localDB.sync(remoteDB, {
      live: true,
      retry: true
    }).on('change', function (info) {
      if (active) setSyncStatus('Sincronizando...');
    }).on('active', function () {
      if (active) setSyncStatus('Sincronizando...');
    }).on('paused', function (err) {
      if (active) setSyncStatus('Sincronizado al día');
    }).on('error', function (err) {
      if (active) setSyncStatus(`Error: ${err}`);
    });

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
      include_docs: true
    }).on('change', (change) => {
      if (change.id === 'axon-pages' && active) {
        setPages((change.doc as any).data);
      }
    });

    return () => {
      active = false;
      sync.cancel();
      changes.cancel();
    };
  }, []);

  return (
    <View style={styles.container}>
      <Text style={styles.title}>Axon Mobile</Text>
      <Text style={styles.status}>Estado: {syncStatus}</Text>
      
      <ScrollView style={styles.list}>
        <Text style={styles.subtitle}>Tus Páginas:</Text>
        {pages.map((page, i) => (
          <View key={i} style={styles.card}>
            <Text style={styles.cardIcon}>{page.icon}</Text>
            <Text style={styles.cardTitle}>{page.title}</Text>
          </View>
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
  }
});
