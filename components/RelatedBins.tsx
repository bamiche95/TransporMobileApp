import React, { useEffect, useState } from 'react';
import {
  View,
  Text,
  FlatList,
  StyleSheet,
  Alert,
  ActivityIndicator,
  TouchableOpacity,
} from 'react-native';
import { useAuth } from '../contexts/AuthContext';

interface Bin {
  bin_description: string;
  bin_number: string;
  bin_name: string;
}

interface RelatedBinsProps {
  customerId: number;
}

const RelatedBins: React.FC<RelatedBinsProps> = ({ customerId }) => {
  const { makeAuthenticatedRequest } = useAuth();
  const [bins, setBins] = useState<Bin[]>([]);
  const [expanded, setExpanded] = useState(false);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchBins = async () => {
      try {
        setLoading(true);
        const response = await makeAuthenticatedRequest(`/bins/${customerId}`, {
          headers: {
            'Cache-Control': 'no-cache',
          },
        });
        const data = await response.json();
        if (response.ok) {
          setBins(data.bins);
        } else {
          Alert.alert('Error', data.error);
        }
      } catch (error) {
        Alert.alert('Error', 'Unable to fetch bins');
      } finally {
        setLoading(false);
      }
    };
    if (customerId) {
      fetchBins();
    }
  }, [customerId]);

  if (loading) {
    return (
      <View style={styles.container}>
        <Text style={styles.sectionTitle}>🗑️ Bins on site</Text>
        <View style={styles.loaderContainer}>
          <ActivityIndicator size="large" color="#3b82f6" />
        </View>
      </View>
    );
  }

  const displayedBins = expanded ? bins : bins.slice(0, 5);

  return (
    <View style={styles.container}>
      <Text style={styles.sectionTitle}>🗑️ Bins on site</Text>

      {/* Table Card */}
      <View style={styles.card}>
        {/* Header Row */}
        <View style={styles.headerRow}>
          <Text style={[styles.headerCell, styles.descriptionCell]}>
            Description
          </Text>
          <Text style={[styles.headerCell, styles.nameCell]}>Bin Name</Text>
          <Text style={[styles.headerCell, styles.numberCell]}>Number</Text>
        </View>

        {/* Data Rows */}
        {displayedBins.map((item, index) => (
          <View
            key={index}
            style={[
              styles.dataRow,
              index % 2 === 0 && styles.dataRowAlternate,
              index === displayedBins.length - 1 && styles.dataRowLast,
            ]}
          >
            <Text
              style={[styles.dataCell, styles.descriptionCell]}
              numberOfLines={2}
            >
              {item.bin_description || '—'}
            </Text>
            <Text
              style={[styles.dataCell, styles.nameCell]}
              numberOfLines={1}
            >
              {item.bin_name || '—'}
            </Text>
            <Text
              style={[styles.dataCell, styles.numberCell]}
              numberOfLines={1}
            >
              {item.bin_number || '—'}
            </Text>
          </View>
        ))}
      </View>

      {/* Show More/Less Button */}
      {bins.length > 5 && (
        <TouchableOpacity
          style={styles.toggleButton}
          onPress={() => setExpanded(!expanded)}
        >
          <Text style={styles.toggleButtonText}>
            {expanded ? 'Show Less' : `Show More (${bins.length - 5} hidden)`}
          </Text>
        </TouchableOpacity>
      )}

      {/* Count Badge */}
      <View style={styles.countBadge}>
        <Text style={styles.countText}>
          {bins.length} bin{bins.length !== 1 ? 's' : ''} available
        </Text>
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    marginTop: 24,
    marginBottom: 8,
  },

  // Section Title
  sectionTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: '#1e293b',
    marginBottom: 16,
    marginHorizontal: 0,
    letterSpacing: -0.2,
  },

  // Loader
  loaderContainer: {
    paddingVertical: 32,
    justifyContent: 'center',
    alignItems: 'center',
  },

  // Empty State
  emptyState: {
    backgroundColor: '#ffffff',
    borderRadius: 12,
    paddingVertical: 32,
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#e2e8f0',
    borderStyle: 'dashed',
  },
  emptyStateIcon: {
    fontSize: 40,
    marginBottom: 12,
  },
  emptyStateText: {
    fontSize: 14,
    color: '#94a3b8',
    fontWeight: '500',
    textAlign: 'center',
  },

  // Card Container
  card: {
    backgroundColor: '#ffffff',
    borderRadius: 12,
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: '#e2e8f0',
    boxShadow: '0px 2px 8px rgba(0, 0, 0, 0.04)',
    elevation: 2,
  },

  // Header Row
  headerRow: {
    flexDirection: 'row',
    backgroundColor: '#f1f5f9',
    borderBottomWidth: 2,
    borderBottomColor: '#e2e8f0',
    paddingHorizontal: 0,
  },
  headerCell: {
    paddingVertical: 14,
    paddingHorizontal: 12,
    fontWeight: '600',
    color: '#1e293b',
    fontSize: 13,
    letterSpacing: -0.1,
    textAlignVertical: 'center',
  },

  // Column Widths
  descriptionCell: {
    flex: 2,
  },
  nameCell: {
    flex: 1.5,
  },
  numberCell: {
    flex: 1,
  },

  // Data Rows
  dataRow: {
    flexDirection: 'row',
    borderBottomWidth: 1,
    borderBottomColor: '#f1f5f9',
    backgroundColor: '#ffffff',
  },
  dataRowAlternate: {
    backgroundColor: '#f8fafc',
  },
  dataRowLast: {
    borderBottomWidth: 0,
  },
  dataCell: {
    paddingVertical: 12,
    paddingHorizontal: 12,
    color: '#0f172a',
    fontSize: 13,
    fontWeight: '400',
    textAlignVertical: 'center',
  },

  // Count Badge
  countBadge: {
    marginTop: 12,
    backgroundColor: '#dbeafe',
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 8,
    alignSelf: 'flex-start',
  },
  countText: {
    fontSize: 12,
    color: '#1e40af',
    fontWeight: '500',
    letterSpacing: -0.1,
  },
  toggleButton: {
    backgroundColor: '#3b82f6',
    paddingVertical: 10,
    paddingHorizontal: 20,
    borderRadius: 8,
    marginTop: 12,
    alignSelf: 'center',
  },
  toggleButtonText: {
    color: '#ffffff',
    fontSize: 14,
    fontWeight: '600',
  },
});

export default RelatedBins;