import 'react-native-get-random-values';
import { Buffer } from 'buffer';
global.Buffer = Buffer;
import { EventEmitter } from 'events';
(global as any).EventEmitter = EventEmitter;

import { StatusBar } from 'expo-status-bar';
import { StyleSheet, Text, View, ScrollView, TouchableOpacity, TextInput, KeyboardAvoidingView, Platform, Modal, Image } from 'react-native';
import { useState, useEffect, useRef } from 'react';
import * as Calendar from 'expo-calendar';
import DateTimePicker from '@react-native-community/datetimepicker';
import * as ImagePicker from 'expo-image-picker';

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
  const [slashMenuId, setSlashMenuId] = useState<string | null>(null);
  const [datePickerConfig, setDatePickerConfig] = useState<{ id: string, date: Date, mode: 'date' | 'time' } | null>(null);
  const revRef = useRef<string | undefined>(undefined);
  const debounceTimer = useRef<any>(null);
  const docId = `axon-blocks-${page.id}`;
  
  useEffect(() => {
    let active = true;

    const loadBlocks = async () => {
      try {
        const doc = await localDB.get(docId);
        if (active) {
          setBlocks((doc as any).data);
          revRef.current = doc._rev;
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
      if (active && change.doc) {
        setBlocks((change.doc as any).data);
        revRef.current = change.doc._rev;
      }
    });

    return () => {
      active = false;
      changes.cancel();
    };
  }, [page.id]);

  const saveBlocks = async (newBlocks: any[]) => {
    // Actualización optimista de UI instantánea
    setBlocks(newBlocks);
    
    // Cancelar el guardado pendiente si hay uno
    if (debounceTimer.current) clearTimeout(debounceTimer.current);
    
    // Programar el nuevo guardado para que ocurra después de que el usuario deje de teclear
    debounceTimer.current = setTimeout(async () => {
      try {
        const payload: any = { _id: docId, data: newBlocks };
        if (revRef.current) payload._rev = revRef.current;
        
        const res = await localDB.put(payload);
        revRef.current = res.rev;
      } catch (err: any) {
        if (err.status === 409 || err.name === 'conflict') {
          try {
            const latestDoc = await localDB.get(docId);
            revRef.current = latestDoc._rev;
            const retryRes = await localDB.put({ _id: docId, _rev: revRef.current, data: newBlocks });
            revRef.current = retryRes.rev;
          } catch (retryErr) {
            console.error('Error resolviendo conflicto:', retryErr);
          }
        } else {
          console.error('Error guardando bloque:', err);
        }
      }
    }, 400); // 400 milisegundos de espera
  };

  const updateBlockContent = (id: string, text: string) => {
    // Si el usuario presiona Enter (detectamos salto de línea)
    if (text.includes('\n')) {
      const parts = text.split('\n');
      const currentText = parts[0];
      const newText = parts.slice(1).join('\n');
      
      const idx = blocks.findIndex(b => b.id === id);
      if (idx === -1) return;
      
      const newBlocks = [...blocks];
      newBlocks[idx] = { ...newBlocks[idx], content: currentText };
      
      let newType = 'paragraph';
      if (newBlocks[idx].type === 'checkbox' || newBlocks[idx].type === 'bullet') {
        newType = newBlocks[idx].type;
      }

      const newBlockId = Math.random().toString(36).substring(2, 9);
      newBlocks.splice(idx + 1, 0, {
        id: newBlockId,
        type: newType,
        content: newText,
      });
      
      saveBlocks(newBlocks);
      setSlashMenuId(null);
      return;
    }

    // Si el usuario escribe "/", mostramos el menú. Si lo borra, lo ocultamos.
    if (text.endsWith('/')) {
      setSlashMenuId(id);
    } else if (slashMenuId === id) {
      setSlashMenuId(null);
    }

    const newBlocks = blocks.map(b => b.id === id ? { ...b, content: text } : b);
    saveBlocks(newBlocks);
  };

  const startSchedulingBlock = (id: string) => {
    setSlashMenuId(null);
    setDatePickerConfig({ id, date: new Date(), mode: 'date' });
  };

  const handleDateChange = (event: any, selectedDate?: Date) => {
    if (event.type === 'dismissed') {
      setDatePickerConfig(null);
      return;
    }
    
    const currentDate = selectedDate || datePickerConfig!.date;
    
    if (Platform.OS === 'android') {
      if (datePickerConfig!.mode === 'date') {
        setDatePickerConfig({ id: datePickerConfig!.id, date: currentDate, mode: 'time' });
      } else {
        setDatePickerConfig(null);
        scheduleBlockToCalendar(datePickerConfig!.id, currentDate);
      }
    } else {
      // iOS actualiza la fecha en vivo
      setDatePickerConfig({ ...datePickerConfig!, date: currentDate });
    }
  };

  const scheduleBlockToCalendar = async (id: string, selectedDate: Date) => {
    const block = blocks.find(b => b.id === id);
    if (!block) return;

    try {
      const { status } = await Calendar.requestCalendarPermissionsAsync();
      if (status !== 'granted') {
        alert('Se requieren permisos de calendario para agendar tareas.');
        return;
      }

      const calendars = await Calendar.getCalendarsAsync(Calendar.EntityTypes.EVENT);
      const defaultCalendar = calendars.find(c => c.isPrimary && c.allowsModifications) 
                           || calendars.find(c => c.allowsModifications) 
                           || calendars[0];

      if (!defaultCalendar) {
        alert('No tienes calendarios configurados en tu dispositivo.');
        return;
      }

      const cleanTitle = block.content.replace(/\/$/, '').trim() || "Nueva Tarea de Axon";
      
      const startDate = selectedDate;
      const endDate = new Date(selectedDate);
      endDate.setHours(startDate.getHours() + 1);

      const eventId = await Calendar.createEventAsync(defaultCalendar.id, {
        title: cleanTitle,
        startDate,
        endDate,
        notes: "Creado desde Axon Workspace"
      });

      const newBlocks = blocks.map(b => b.id === id ? { 
        ...b, 
        type: 'checkbox', 
        content: cleanTitle, 
        eventId 
      } : b);
      
      saveBlocks(newBlocks);
      setSlashMenuId(null);
      alert(`¡Agendado en tu calendario "${defaultCalendar.title}"! 📅`);
      
    } catch (err) {
      console.error("Error agendando", err);
      alert('Hubo un error al sincronizar con tu calendario.');
    }
  };

  const takePhotoAndSaveBlock = async (id: string) => {
    try {
      const permissionResult = await ImagePicker.requestCameraPermissionsAsync();
      
      if (permissionResult.granted === false) {
        alert("¡Necesitamos permiso para acceder a tu cámara!");
        return;
      }

      const result = await ImagePicker.launchCameraAsync({
        mediaTypes: ['images'],
        allowsEditing: false,
        quality: 0.5,
        base64: true,
      });

      if (!result.canceled && result.assets && result.assets.length > 0) {
        const base64Data = result.assets[0].base64;
        const dataUri = `data:image/jpeg;base64,${base64Data}`;

        const newBlocks = blocks.map(b => b.id === id ? { 
          ...b, 
          type: 'image', 
          content: dataUri 
        } : b);
        
        saveBlocks(newBlocks);
        setSlashMenuId(null);
      }
    } catch (error) {
      console.error("Error tomando la foto:", error);
      alert("Hubo un error al tomar la foto.");
    }
  };

  const changeBlockType = (id: string, type: string) => {
    // Quitamos la barra "/" final al cambiar el tipo
    const newBlocks = blocks.map(b => b.id === id ? { ...b, type, content: b.content.replace(/\/$/, '') } : b);
    saveBlocks(newBlocks);
    setSlashMenuId(null);
  };

  const toggleCheckbox = async (id: string, checked: boolean) => {
    const block = blocks.find(b => b.id === id);
    if (block?.eventId) {
      try {
        const { status } = await Calendar.requestCalendarPermissionsAsync();
        if (status === 'granted') {
          const event = await Calendar.getEventAsync(block.eventId);
          if (event) {
            let newTitle = event.title;
            if (checked && !newTitle.startsWith('✅ ')) {
              newTitle = `✅ ${newTitle}`;
            } else if (!checked && newTitle.startsWith('✅ ')) {
              newTitle = newTitle.replace('✅ ', '');
            }
            await Calendar.updateEventAsync(block.eventId, { title: newTitle });
          }
        }
      } catch (e) {
        console.error("Error actualizando evento:", e);
      }
    }

    const newBlocks = blocks.map(b => b.id === id ? { ...b, checked } : b);
    saveBlocks(newBlocks);
  };

  const renderSlashMenu = (blockId: string) => {
    if (slashMenuId !== blockId) return null;
    return (
      <View style={styles.slashMenu}>
        <Text style={styles.slashMenuTitle}>Convierte este bloque a:</Text>
        <ScrollView horizontal showsHorizontalScrollIndicator={false}>
          <TouchableOpacity style={styles.slashMenuItem} onPress={() => takePhotoAndSaveBlock(blockId)}><Text>📸 Tomar Foto</Text></TouchableOpacity>
          <TouchableOpacity style={styles.slashMenuItem} onPress={() => startSchedulingBlock(blockId)}><Text>📅 Agendar</Text></TouchableOpacity>
          <TouchableOpacity style={styles.slashMenuItem} onPress={() => changeBlockType(blockId, 'checkbox')}><Text>☑ Tarea</Text></TouchableOpacity>
          <TouchableOpacity style={styles.slashMenuItem} onPress={() => changeBlockType(blockId, 'h1')}><Text>T1 Título</Text></TouchableOpacity>
          <TouchableOpacity style={styles.slashMenuItem} onPress={() => changeBlockType(blockId, 'bullet')}><Text>• Lista</Text></TouchableOpacity>
          <TouchableOpacity style={styles.slashMenuItem} onPress={() => changeBlockType(blockId, 'paragraph')}><Text>Texto Normal</Text></TouchableOpacity>
        </ScrollView>
      </View>
    );
  };

  return (
    <>
      <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined} style={{ flex: 1 }}>
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
          <View key={block.id}>
            <View style={styles.blockRow}>
              {block.type === 'checkbox' && (
                <TouchableOpacity onPress={() => toggleCheckbox(block.id, !block.checked)}>
                  <View style={[styles.checkbox, block.checked && styles.checkboxChecked]} />
                </TouchableOpacity>
              )}
              {block.type === 'bullet' && <Text style={styles.bullet}>•</Text>}
              
              {block.type === 'image' ? (
                <View style={styles.imageBlockContainer}>
                  <Image source={{ uri: block.content }} style={styles.blockImage} />
                </View>
              ) : (
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
                  blurOnSubmit={false}
                  placeholder={block.type === 'paragraph' ? "Escribe o usa '/' para comandos" : ""}
                  placeholderTextColor="#ccc"
                />
              )}
            </View>
            {renderSlashMenu(block.id)}
          </View>
        ))}
        {blocks.length === 0 && (
          <Text style={{color: '#999', marginTop: 20}}>Página vacía o cargando bloques...</Text>
        )}
      </ScrollView>
    </KeyboardAvoidingView>

    {/* DatePicker para Android */}
    {datePickerConfig && Platform.OS === 'android' && (
      <DateTimePicker
        value={datePickerConfig.date}
        mode={datePickerConfig.mode}
        is24Hour={true}
        display="default"
        onChange={handleDateChange}
      />
    )}

    {/* DatePicker Modal para iOS */}
    {datePickerConfig && Platform.OS === 'ios' && (
      <Modal transparent animationType="slide">
        <View style={styles.iosPickerContainer}>
          <View style={styles.iosPickerPanel}>
            <DateTimePicker
              value={datePickerConfig.date}
              mode="datetime"
              display="spinner"
              onChange={handleDateChange}
            />
            <TouchableOpacity style={styles.iosConfirmBtn} onPress={() => {
              if (datePickerConfig) {
                scheduleBlockToCalendar(datePickerConfig.id, datePickerConfig.date);
                setDatePickerConfig(null);
              }
            }}>
              <Text style={styles.iosConfirmText}>Confirmar Horario</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>
    )}
    </>
  );
}

export default function App() {
  const [pages, setPages] = useState<any[]>([]);
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
      if (active && change.doc) {
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
  },
  slashMenu: {
    backgroundColor: '#f8f9fa',
    borderRadius: 8,
    padding: 12,
    marginTop: 4,
    marginBottom: 16,
    borderWidth: 1,
    borderColor: '#e2e8f0',
  },
  slashMenuTitle: {
    fontSize: 12,
    color: '#64748b',
    marginBottom: 12,
    fontWeight: '600',
    textTransform: 'uppercase',
  },
  slashMenuItem: {
    backgroundColor: '#fff',
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderRadius: 20,
    marginRight: 8,
    borderWidth: 1,
    borderColor: '#e2e8f0',
    elevation: 1, // Sombra ligera en Android
    shadowColor: '#000', // Sombra ligera en iOS
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.1,
    shadowRadius: 1,
  },
  iosPickerContainer: {
    flex: 1,
    justifyContent: 'flex-end',
    backgroundColor: 'rgba(0,0,0,0.4)',
  },
  iosPickerPanel: {
    backgroundColor: '#fff',
    paddingBottom: 40,
    paddingTop: 20,
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
  },
  iosConfirmBtn: {
    backgroundColor: '#0052cc',
    marginHorizontal: 20,
    marginTop: 10,
    padding: 15,
    borderRadius: 10,
    alignItems: 'center',
  },
  iosConfirmText: {
    color: '#fff',
    fontWeight: 'bold',
    fontSize: 16,
  },
  imageBlockContainer: {
    flex: 1,
    alignItems: 'center',
    marginVertical: 10,
    width: '100%',
  },
  blockImage: {
    width: '100%',
    height: 300,
    borderRadius: 8,
    resizeMode: 'contain',
  }
});
