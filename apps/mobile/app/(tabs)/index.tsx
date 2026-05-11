import { View, Text, StyleSheet } from 'react-native';

export default function TripsScreen() {
  return (
    <View style={styles.container}>
      <Text style={styles.title}>Vacationist</Text>
      <Text style={styles.subtitle}>Your trips will appear here</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#0F0F0F',
  },
  title: {
    fontSize: 28,
    fontWeight: 'bold',
    color: '#F2F2F2',
  },
  subtitle: {
    fontSize: 15,
    color: '#A0A0A0',
    marginTop: 8,
  },
});
